import "server-only";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { googleAccessToken, driveServiceEmail } from "@/lib/google-drive";
import { getPurchases } from "@/lib/purchases";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIES, getLedger, monthOf, monthlySummary, type LedgerEntry } from "@/lib/expense-ledger";

/*
 * Planilla de gastos en Google Sheets: una hoja por mes ("2026-11") con cada movimiento y una hoja
 * "Resumen" con el total por categoría y mes. Cada sincronización reescribe las hojas (así una
 * reclasificación se refleja sola). La planilla la crea la tienda en su Drive y la comparte con la
 * cuenta de servicio como editora; su id se guarda en config/planilla-gastos.json.
 */

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const CONFIG = "planilla-gastos.json";
const API = "https://sheets.googleapis.com/v4/spreadsheets";

type SheetConfig = { id: string; title?: string; connectedAt: string; syncedAt?: string | null; error?: string | null };

export async function getSheetConfig() {
  return readConfigJson<SheetConfig | null>(CONFIG, null);
}

/** Acepta el enlace completo o solo el id */
export function sheetIdFrom(input: string) {
  return /\/d\/([a-zA-Z0-9_-]{20,})/.exec(input)?.[1] ?? (/^[a-zA-Z0-9_-]{20,}$/.test(input.trim()) ? input.trim() : null);
}

async function sheets<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await googleAccessToken(SCOPE);
  const res = await fetch(`${API}/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; status?: string } } & T;
  if (!res.ok) {
    const msg = json.error?.message ?? `Google respondió ${res.status}`;
    if (res.status === 403 && /has not been used|disabled/i.test(msg)) throw new Error("Falta habilitar la «Google Sheets API» en el proyecto de Google Cloud de la cuenta de servicio.");
    if (res.status === 403 || res.status === 404) throw new Error(`La cuenta de servicio no puede abrir la planilla. Compártela como Editor con ${driveServiceEmail()}.`);
    throw new Error(msg);
  }
  return json;
}

/** Comprueba el acceso y guarda la planilla */
export async function connectSheet(input: string) {
  const id = sheetIdFrom(input);
  if (!id) throw new Error("Pega el enlace de la planilla de Google Sheets.");
  const meta = await sheets<{ properties: { title: string } }>(`${id}?fields=properties.title`);
  const cfg: SheetConfig = { id, title: meta.properties.title, connectedAt: new Date().toISOString() };
  await writeConfigJson(CONFIG, cfg);
  return cfg;
}

const dateFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const ORIGIN: Record<LedgerEntry["origin"], string> = { feria: "Jornada de feria", factura: "Factura de compra", regla: "Regla automática", manual: "Clasificado a mano", pendiente: "Pendiente" };
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

/** Reescribe las hojas de todos los meses y el resumen */
export async function syncSheet() {
  const cfg = await getSheetConfig();
  if (!cfg) return { configured: false as const };
  try {
    const [{ entries }, purchases, { data: sessions }] = await Promise.all([getLedger(), getPurchases(), createAdminClient().from("fair_sessions").select("id, name")]);
    const fairName = new Map((sessions ?? []).map((s) => [s.id, s.name as string]));
    const purchase = new Map(purchases.map((p) => [p.id, `${p.supplier}${p.folio ? ` · folio ${p.folio}` : ""}`]));
    const months = [...new Set(entries.map((e) => monthOf(e.date)))].sort();

    // Hojas que faltan
    const meta = await sheets<{ sheets: { properties: { title: string; sheetId: number } }[] }>(`${cfg.id}?fields=sheets.properties`);
    const existing = new Set(meta.sheets.map((s) => s.properties.title));
    const missing = ["Resumen", ...months].filter((t) => !existing.has(t));
    if (missing.length) {
      await sheets(`${cfg.id}:batchUpdate`, {
        method: "POST",
        body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }),
      });
    }

    const data: { range: string; values: (string | number)[][] }[] = [];
    for (const m of months) {
      const rows = entries.filter((e) => monthOf(e.date) === m);
      const total = rows.filter((e) => e.category !== "No es gasto").reduce((s, e) => s + e.amountClp, 0);
      data.push({
        range: `'${m}'!A1`,
        values: [
          ["Fecha", "Comercio / detalle", "Monto (CLP)", "Categoría", "Origen", "Vínculo", "Nota", "Tipo", "ID Mercado Pago"],
          ...rows.map((e) => [
            dateFmt.format(new Date(e.date)),
            e.detail,
            e.amountClp,
            e.category,
            ORIGIN[e.origin],
            e.sessionId ? `Feria: ${fairName.get(e.sessionId) ?? e.sessionId}` : e.purchaseId ? `Factura: ${purchase.get(e.purchaseId) ?? e.purchaseId}` : "",
            e.note ?? "",
            e.source === "pago" ? "Pago" : "Transferencia",
            e.id,
          ]),
          [],
          ["", `Total gastos de ${monthName(m)} (sin «No es gasto»)`, total],
        ],
      });
    }
    const summary = monthlySummary(entries);
    const cats = CATEGORIES.filter((c) => c !== "No es gasto");
    data.push({
      range: "'Resumen'!A1",
      values: [
        ["Categoría", ...months.map(monthName), "Total"],
        ...cats.map((c) => {
          const vals = months.map((m) => summary.get(m)?.get(c) ?? 0);
          return [c, ...vals, vals.reduce((s, v) => s + v, 0)];
        }),
        ["Total", ...months.map((m) => [...(summary.get(m)?.values() ?? [])].reduce((s, v) => s + v, 0)), entries.filter((e) => e.category !== "No es gasto").reduce((s, e) => s + e.amountClp, 0)],
        [],
        [`Actualizado: ${dateFmt.format(new Date())} · Fuente: cuenta de Mercado Pago, desde noviembre de 2026`],
      ],
    });

    await sheets(`${cfg.id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: ["'Resumen'!A:Z", ...months.map((m) => `'${m}'!A:Z`)] }) });
    await sheets(`${cfg.id}/values:batchUpdate`, { method: "POST", body: JSON.stringify({ valueInputOption: "RAW", data }) });
    await writeConfigJson(CONFIG, { ...cfg, syncedAt: new Date().toISOString(), error: null });
    return { configured: true as const, months: months.length, rows: entries.length };
  } catch (e) {
    await writeConfigJson(CONFIG, { ...cfg, error: (e as Error).message });
    throw e;
  }
}
