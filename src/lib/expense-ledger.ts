import "server-only";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { getMpExpenses, merchantKey, mpExpensesEnabled } from "@/lib/fair-mp-expenses";
import { getPurchases } from "@/lib/purchases";

/*
 * Libro de gastos: todo lo que sale de la cuenta de Mercado Pago (la única cuenta del negocio).
 * Una sola fuente, Mercado Pago; ferias y facturas son vínculos, así nada se cuenta dos veces:
 *   - pago hecho en los días de una jornada de feria → "Feria" (lo decidido en la jornada manda)
 *   - pago que calza con una factura de Compras (monto y fecha) → "Mercadería", ligado a la factura
 *   - comercio con regla (por defecto o recordada) → su categoría
 *   - lo demás → "Por clasificar" (se clasifica en Admin → Gastos y se recuerda el comercio)
 * Se guarda en config/libro-gastos.json y se vuelca a una planilla de Google Sheets (una hoja por mes).
 * Desde el 1-11-2026. Las transferencias y retiros (reporte de movimientos) se suman en una segunda etapa.
 */

const STORE = "libro-gastos.json";
const API = "https://api.mercadopago.com";
export const LEDGER_START = "2026-11-01T00:00:00-03:00";

export const CATEGORIES = [
  "Mercadería",
  "Feria",
  "Transporte",
  "Envíos",
  "Insumos y empaque",
  "Publicidad",
  "Software y servicios",
  "Comisiones y bancos",
  "Comida",
  "Otros gastos",
  "No es gasto",
  "Por clasificar",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type LedgerEntry = {
  /** Id del pago en Mercado Pago */
  id: string;
  source: "pago" | "transferencia";
  date: string;
  amountClp: number;
  detail: string;
  category: Category;
  /** De dónde salió la categoría */
  origin: "feria" | "factura" | "regla" | "manual" | "pendiente";
  sessionId?: string | null;
  purchaseId?: string | null;
  note?: string;
  updatedAt: string;
};

type Store = { entries: LedgerEntry[]; rules: Record<string, Category>; syncedAt: string | null; sheetSyncedAt?: string | null };

/** Reglas por defecto (comercio → categoría); las que se recuerdan en el admin tienen prioridad */
const DEFAULT_RULES: [RegExp, Category][] = [
  [/uber|cabify|didi|taxi|indriver|copec|shell|petrobras|aramco|estacionamiento|parking|autopista|metro|bip/, "Transporte"],
  [/blue ?express|bluex|starken|chilexpress|correos de chile|envia|shipit/, "Envíos"],
  [/facebook|meta|instagram|google ads|tiktok/, "Publicidad"],
  [/anthropic|vercel|supabase|resend|improvmx|canva|github|openai|google|apple|microsoft|hostinger|qrkit/, "Software y servicios"],
  [/rappi|pedidosya|restaurant|sushi|pizza|burger|food|comida/, "Comida"],
  [/sodimac|easy|envase|bolsa|etiqueta|imprenta|libreri/, "Insumos y empaque"],
];

export async function getLedger(): Promise<Store> {
  return readConfigJson<Store>(STORE, { entries: [], rules: {}, syncedAt: null });
}

async function saveLedger(store: Store) {
  store.entries.sort((a, b) => a.date.localeCompare(b.date));
  await writeConfigJson(STORE, store);
}

type MpPayment = {
  id: number;
  date_created: string;
  date_approved: string | null;
  status: string;
  transaction_amount: number;
  description: string | null;
  statement_descriptor?: string | null;
  collector_id?: number | null;
};

async function mpGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

/** Pagos hechos por la cuenta en un rango (todas las páginas) */
async function paymentsMade(fromIso: string, toIso: string) {
  const me = (await mpGet<{ id: number }>("/users/me")).id;
  const out: MpPayment[] = [];
  for (let offset = 0; offset < 5000; offset += 100) {
    const q = `payer.id=${me}&range=date_created&begin_date=${encodeURIComponent(fromIso)}&end_date=${encodeURIComponent(toIso)}&sort=date_created&criteria=asc&limit=100&offset=${offset}`;
    const r = await mpGet<{ results: MpPayment[]; paging: { total: number } }>(`/v1/payments/search?${q}`);
    out.push(...r.results.filter((p) => p.collector_id !== me));
    if (offset + 100 >= (r.paging?.total ?? 0)) break;
  }
  return out;
}

const SPENT = ["approved", "authorized", "in_process", "pending"];
const DAY = 86400_000;

/** Categoría por reglas: primero las recordadas, luego las por defecto */
function byRule(detail: string, rules: Store["rules"]): Category | null {
  const key = merchantKey(detail);
  if (rules[key]) return rules[key];
  const d = detail.toLowerCase();
  return DEFAULT_RULES.find(([re]) => re.test(d))?.[1] ?? null;
}

/** Factura de Compras que calza con el pago: monto con IVA (±3 %) y fecha cercana (±20 días) */
function matchPurchase(amount: number, dateIso: string, purchases: Awaited<ReturnType<typeof getPurchases>>, used: Set<string>) {
  const t = new Date(dateIso).getTime();
  return purchases.find((p) => {
    if (used.has(p.id) || p.status === "descartada" || !p.netTotalClp) return false;
    const totals = [p.netTotalClp * 1.19, (p.netTotalClp + p.otherChargesNetClp) * 1.19];
    const okAmount = totals.some((x) => Math.abs(x - amount) / x <= 0.03);
    const okDate = !p.date || Math.abs(new Date(`${p.date}T12:00:00-03:00`).getTime() - t) <= 20 * DAY;
    return okAmount && okDate;
  });
}

/**
 * Trae los pagos de Mercado Pago desde la última lectura (re-lee 7 días por cambios de estado) y los
 * clasifica. Las decisiones manuales no se pisan.
 */
export async function syncLedger(now = new Date()) {
  if (!mpExpensesEnabled()) return { enabled: false as const, added: 0, removed: 0 };
  const store = await getLedger();
  const from = store.syncedAt ? new Date(Math.max(new Date(LEDGER_START).getTime(), new Date(store.syncedAt).getTime() - 7 * DAY)) : new Date(LEDGER_START);
  const [payments, fairItems, purchases] = await Promise.all([paymentsMade(from.toISOString(), now.toISOString()), getMpExpenses(), getPurchases()]);
  const fairById = new Map(fairItems.map((f) => [f.mpId, f]));
  const byId = new Map(store.entries.map((e) => [e.id, e]));
  const usedPurchases = new Set(store.entries.flatMap((e) => (e.purchaseId ? [e.purchaseId] : [])));
  const stamp = now.toISOString();
  let added = 0;
  let removed = 0;

  for (const p of payments) {
    const id = String(p.id);
    const existing = byId.get(id);
    if (!SPENT.includes(p.status)) {
      // Rechazado, anulado o devuelto: deja de ser gasto
      if (existing) {
        store.entries = store.entries.filter((e) => e.id !== id);
        byId.delete(id);
        removed++;
      }
      continue;
    }
    const detail = [p.description, p.statement_descriptor].filter(Boolean).join(" · ") || "Pago con Mercado Pago";
    const entry: LedgerEntry = existing ?? {
      id,
      source: "pago",
      date: p.date_approved ?? p.date_created,
      amountClp: Math.round(p.transaction_amount),
      detail,
      category: "Por clasificar",
      origin: "pendiente",
      updatedAt: stamp,
    };
    entry.amountClp = Math.round(p.transaction_amount);
    if (entry.origin !== "manual") classify(entry, { fair: fairById.get(id), rules: store.rules, purchases, usedPurchases });
    if (!existing) {
      store.entries.push(entry);
      byId.set(id, entry);
      added++;
    }
  }
  // Lo que se decidió en una jornada de feria después de la última lectura también se refleja
  for (const e of store.entries) {
    if (e.origin !== "manual") classify(e, { fair: fairById.get(e.id), rules: store.rules, purchases, usedPurchases });
  }
  store.syncedAt = stamp;
  await saveLedger(store);
  return { enabled: true as const, added, removed };
}

export function classify(
  e: LedgerEntry,
  ctx: { fair?: Awaited<ReturnType<typeof getMpExpenses>>[number]; rules: Store["rules"]; purchases: Awaited<ReturnType<typeof getPurchases>>; usedPurchases: Set<string> },
) {
  const set = (category: Category, origin: LedgerEntry["origin"], links: Pick<LedgerEntry, "sessionId" | "purchaseId"> = {}) => {
    const changed =
      e.category !== category ||
      e.origin !== origin ||
      (links.sessionId !== undefined && links.sessionId !== e.sessionId) ||
      (links.purchaseId !== undefined && links.purchaseId !== e.purchaseId);
    Object.assign(e, { category, origin, ...links });
    if (changed) e.updatedAt = new Date().toISOString();
  };
  // 1. Feria: lo decidido en la jornada manda
  if (ctx.fair) {
    const f = ctx.fair;
    if (f.status === "feria") return set("Feria", "feria", { sessionId: f.sessionId });
    if (f.status === "no_gasto") return set("No es gasto", "feria", { sessionId: f.sessionId });
    // "mercadería" en la feria: se busca su factura igual que el resto
  }
  // 2. Factura de Compras
  if (e.purchaseId) return set("Mercadería", "factura");
  const match = matchPurchase(e.amountClp, e.date, ctx.purchases, ctx.usedPurchases);
  if (match) {
    ctx.usedPurchases.add(match.id);
    return set("Mercadería", "factura", { purchaseId: match.id });
  }
  if (ctx.fair?.status === "mercaderia") return set("Mercadería", "feria", { sessionId: ctx.fair.sessionId });
  // 3. Reglas
  const rule = byRule(e.detail, ctx.rules);
  if (rule) return set(rule, "regla");
  if (e.origin !== "pendiente") set("Por clasificar", "pendiente");
}

/** Clasificación manual; con `remember`, se aplica a los demás pagos de ese comercio que no se clasificaron a mano */
export async function classifyEntry(id: string, category: Category, note: string | undefined, remember: boolean) {
  const store = await getLedger();
  const e = store.entries.find((x) => x.id === id);
  if (!e) throw new Error("No encontramos ese gasto.");
  Object.assign(e, { category, origin: "manual", updatedAt: new Date().toISOString(), ...(note !== undefined ? { note } : {}) });
  if (remember && category !== "Por clasificar") {
    const key = merchantKey(e.detail);
    store.rules[key] = category;
    for (const x of store.entries) {
      if (x.id !== id && x.origin !== "manual" && x.origin !== "feria" && x.origin !== "factura" && merchantKey(x.detail) === key) {
        Object.assign(x, { category, origin: "regla", updatedAt: new Date().toISOString() });
      }
    }
  }
  await saveLedger(store);
  return e;
}

/** Totales por mes y categoría (sin "No es gasto") */
export function monthlySummary(entries: LedgerEntry[]) {
  const months = new Map<string, Map<Category, number>>();
  for (const e of entries) {
    if (e.category === "No es gasto") continue;
    const m = monthOf(e.date);
    const row = months.get(m) ?? new Map<Category, number>();
    row.set(e.category, (row.get(e.category) ?? 0) + e.amountClp);
    months.set(m, row);
  }
  return months;
}

const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit" });
/** "2026-11" en hora de Chile */
export const monthOf = (iso: string) => monthFmt.format(new Date(iso)).slice(0, 7);

// --- Segunda etapa: transferencias y retiros (reporte de movimientos de Mercado Pago) -------------
// El reporte se genera en segundo plano y entrega un CSV. Antes de leerlo en el libro se revisan
// sus columnas reales desde Admin → Gastos.

async function mpRaw(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

/** Pide el reporte de movimientos (liberaciones) de un rango; Mercado Pago lo prepara en minutos */
export async function requestMovementsReport(fromIso: string, toIso: string) {
  const r = await mpRaw("/v1/account/release_report", { method: "POST", body: JSON.stringify({ begin_date: fromIso, end_date: toIso }) });
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${r.text.slice(0, 200)}`);
}

export async function listMovementsReports() {
  const r = await mpRaw("/v1/account/release_report/list");
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${r.text.slice(0, 200)}`);
  const list = JSON.parse(r.text) as { file_name: string; date_created?: string; begin_date?: string; end_date?: string }[];
  return Array.isArray(list) ? list.slice(0, 5) : [];
}

/** Columnas y tipos de movimiento de un reporte (sin montos ni datos de clientes) */
export async function inspectMovementsReport(fileName: string) {
  const r = await mpRaw(`/v1/account/release_report/${encodeURIComponent(fileName)}`);
  if (!r.ok) throw new Error(`Mercado Pago respondió ${r.status}: ${r.text.slice(0, 200)}`);
  const lines = r.text.split(/\r?\n/).filter(Boolean);
  const sep = (lines[0] ?? "").includes(";") ? ";" : ",";
  const header = (lines[0] ?? "").split(sep).map((h) => h.trim());
  const idx = header.findIndex((h) => /DESCRIPTION|RECORD_TYPE|TRANSACTION_TYPE/i.test(h));
  const types = new Map<string, number>();
  for (const l of lines.slice(1)) {
    const t = idx >= 0 ? (l.split(sep)[idx] ?? "").trim() : "?";
    types.set(t, (types.get(t) ?? 0) + 1);
  }
  return { header, rows: lines.length - 1, types: [...types.entries()].sort((a, b) => b[1] - a[1]) };
}
