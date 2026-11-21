import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { startOfTodayChile } from "@/lib/format";
import type { ExpenseCategory, FairExpense } from "@/lib/costs";

/*
 * Gastos de feria desde Mercado Pago.
 * Todo lo que la cuenta paga con Mercado Pago (tarjeta de débito o saldo: Uber, comida, agua,
 * algo que faltó) durante los días de una jornada de feria se anota solo como gasto de esa jornada:
 * desde las 00:00 del día de apertura hasta las 23:59 del día de cierre (el Uber de ida se paga
 * antes de abrir). Son gastos sin factura: restan el monto completo.
 *
 * Excepciones, con un clic en la jornada (y se recuerdan por comercio):
 *   - "mercaderia": productos que faltaron; tienen factura y entran por Compras (Drive).
 *   - "no_gasto": algo que no es del negocio.
 * El stand sigue siendo manual (tiene factura: se resta sin IVA, en fair-profit).
 *
 * Fuente: /v1/payments/search con payer.id = la cuenta (probado en Admin → /admin/mercadopago).
 * Se guarda en config/gastos-mp.json.
 */

const STORE = "gastos-mp.json";
const API = "https://api.mercadopago.com";
/** Estados de un pago que sí es un gasto (el débito queda "authorized" hasta que se liquida) */
const SPENT = ["approved", "authorized", "in_process", "pending"];

export type MpExpenseStatus = "feria" | "mercaderia" | "no_gasto";

export type MpExpense = {
  mpId: string;
  sessionId: string;
  date: string;
  amountClp: number;
  detail: string;
  category: ExpenseCategory;
  status: MpExpenseStatus;
  /** La decisión vino de una regla recordada para ese comercio (no hace falta revisarlo) */
  byRule?: boolean;
  /** Revisado y guardado en el admin */
  confirmedAt?: string;
  createdAt: string;
};

type Store = { items: MpExpense[]; rules: Record<string, Exclude<MpExpenseStatus, "feria">> };

export const MP_STATUS_LABEL: Record<MpExpenseStatus, string> = {
  feria: "Gasto de la feria",
  mercaderia: "Mercadería (va por factura)",
  no_gasto: "No es gasto del negocio",
};

/** Solo con la clave de producción: la de prueba (TEST-…) traería pagos ficticios a la base compartida */
export function mpExpensesEnabled() {
  return (process.env.MP_ACCESS_TOKEN ?? "").startsWith("APP_USR");
}

async function getStore(): Promise<Store> {
  return readConfigJson<Store>(STORE, { items: [], rules: {} });
}

/** Comercio normalizado, para recordar decisiones ("Payu *uber trip" → "payu uber trip") */
export function merchantKey(detail: string) {
  return detail
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 4)
    .join(" ");
}

export function guessCategory(detail: string): ExpenseCategory {
  const d = detail.toLowerCase();
  if (/uber|cabify|didi|taxi|beat|indriver|copec|shell|petrobras|aramco|estacionamiento|parking|metro|bip|autopista/.test(d)) return "Transporte";
  if (/rappi|pedidosya|restaurant|resto|sushi|pizza|burger|cafe|food|comida|lider|jumbo|unimarc|tottus|santa isabel|oxxo|ok market|minimarket|botiller|almac|panader/.test(d)) return "Comida";
  if (/sodimac|easy|ferreter|libreri|bazar|envase|hielo/.test(d)) return "Insumos";
  return "Otro";
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

let accountId: number | null = null;
async function myAccountId() {
  accountId ??= (await mpGet<{ id: number }>("/users/me")).id;
  return accountId;
}

/** Pagos hechos por la cuenta entre dos fechas (todas las páginas) */
async function paymentsMade(fromIso: string, toIso: string) {
  const me = await myAccountId();
  const out: MpPayment[] = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const q = `payer.id=${me}&range=date_created&begin_date=${encodeURIComponent(fromIso)}&end_date=${encodeURIComponent(toIso)}&sort=date_created&criteria=asc&limit=100&offset=${offset}`;
    const r = await mpGet<{ results: MpPayment[]; paging: { total: number } }>(`/v1/payments/search?${q}`);
    // Por si el filtro dejara pasar cobros: solo pagos donde otro cobra
    out.push(...r.results.filter((p) => p.collector_id !== me));
    if (offset + 100 >= (r.paging?.total ?? 0)) break;
  }
  return out;
}

type Session = { id: string; opened_at: string; closed_at: string | null };

/** Día completo en Chile: desde las 00:00 de la apertura hasta las 23:59 del cierre (o de hoy si sigue abierta) */
function windowOf(s: Session, now: Date) {
  const from = startOfTodayChile(new Date(s.opened_at));
  const lastDay = startOfTodayChile(s.closed_at ? new Date(s.closed_at) : now);
  const to = new Date(new Date(lastDay).getTime() + 86400_000 - 1).toISOString();
  return { from, to };
}

/**
 * Trae los pagos de Mercado Pago de los días de las jornadas y los anota como gastos.
 * Sin `sessionIds`: las jornadas abiertas o abiertas en los últimos 3 días (la tarea periódica).
 */
export async function syncFairMpExpenses(sessionIds?: string[], now = new Date()) {
  if (!mpExpensesEnabled()) return { enabled: false as const, added: 0, removed: 0 };
  const db = createAdminClient();
  const query = db.from("fair_sessions").select("id, opened_at, closed_at").order("opened_at");
  const { data: sessions, error } = sessionIds?.length
    ? await query.in("id", sessionIds)
    : await query.or(`closed_at.is.null,opened_at.gte.${new Date(now.getTime() - 3 * 86400_000).toISOString()}`);
  if (error) throw new Error(error.message);
  if (!sessions?.length) return { enabled: true as const, added: 0, removed: 0 };

  const store = await getStore();
  const known = new Map(store.items.map((i) => [i.mpId, i]));
  let added = 0;
  let removed = 0;
  for (const s of sessions as Session[]) {
    const { from, to } = windowOf(s, now);
    const payments = await paymentsMade(from, to);
    for (const p of payments) {
      const id = String(p.id);
      const existing = known.get(id);
      if (!SPENT.includes(p.status)) {
        // Rechazado, anulado o devuelto: deja de ser gasto
        if (existing) {
          store.items = store.items.filter((i) => i.mpId !== id);
          known.delete(id);
          removed++;
        }
        continue;
      }
      if (existing) {
        existing.amountClp = Math.round(p.transaction_amount);
        continue;
      }
      // Un pago se anota en una sola jornada (la primera cuyo día lo contiene)
      const detail = [p.description, p.statement_descriptor].filter(Boolean).join(" · ") || "Pago con Mercado Pago";
      const rule = store.rules[merchantKey(detail)];
      const item: MpExpense = {
        mpId: id,
        sessionId: s.id,
        date: p.date_approved ?? p.date_created,
        amountClp: Math.round(p.transaction_amount),
        detail,
        category: guessCategory(detail),
        status: rule ?? "feria",
        ...(rule && { byRule: true }),
        createdAt: now.toISOString(),
      };
      store.items.push(item);
      known.set(id, item);
      added++;
    }
  }
  await saveItems(store);
  return { enabled: true as const, added, removed };
}

/** Guarda releyendo el archivo: respeta decisiones tomadas entretanto en el admin */
async function saveItems(next: Store) {
  const current = await getStore();
  const decided = new Map(current.items.map((i) => [i.mpId, i]));
  next.items = next.items.map((i) => {
    const d = decided.get(i.mpId);
    return d ? { ...i, status: d.status, category: d.category, byRule: d.byRule, confirmedAt: d.confirmedAt } : i;
  });
  next.rules = { ...next.rules, ...current.rules };
  await writeConfigJson(STORE, next);
}

export async function getMpExpenses(sessionId?: string) {
  const s = await getStore();
  return sessionId ? s.items.filter((i) => i.sessionId === sessionId) : s.items;
}

/** Gastos de feria de Mercado Pago por jornada, con la forma de los gastos manuales */
export async function getMpFairExpensesBySession(): Promise<Record<string, FairExpense[]>> {
  const out: Record<string, FairExpense[]> = {};
  for (const i of (await getStore()).items) {
    if (i.status !== "feria") continue;
    (out[i.sessionId] ??= []).push({ id: `mp-${i.mpId}`, category: i.category, concept: `${i.detail} (Mercado Pago)`, amountClp: i.amountClp });
  }
  return out;
}

/** Cambia la decisión de un pago; con `remember`, se aplica también a los próximos pagos de ese comercio */
export async function decideMpExpense(mpId: string, change: { status?: MpExpenseStatus; category?: ExpenseCategory; remember?: boolean }) {
  const s = await getStore();
  const item = s.items.find((i) => i.mpId === mpId);
  if (!item) throw new Error("No encontramos ese pago.");
  if (change.category) item.category = change.category;
  item.confirmedAt = new Date().toISOString();
  if (change.status) {
    item.status = change.status;
    item.byRule = false;
    const key = merchantKey(item.detail);
    if (change.remember) {
      if (change.status === "feria") delete s.rules[key];
      else s.rules[key] = change.status;
    }
  }
  await writeConfigJson(STORE, s);
  return item;
}
