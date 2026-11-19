import "server-only";

/*
 * Pagos que HACE la cuenta de Mercado Pago de la tienda (gastos: Uber, comida, insumos pagados
 * con QR o saldo), para registrarlos como gastos de feria.
 *
 * Diagnóstico (Admin → Mercado Pago): la documentación de Mercado Pago no deja claro qué vía
 * entrega estos pagos con la clave de la propia cuenta, así que se prueban dos:
 *   A. /v1/payments/search filtrando por payer.id = la cuenta (pagos donde la tienda paga).
 *   B. Reporte de liberaciones (/v1/account/release_report): todos los movimientos del dinero en cuenta.
 */

const API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN");
  return t;
}

async function mp<T>(path: string, init: RequestInit = {}): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, status: res.status, error: text.slice(0, 300) };
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: true, data: text as unknown as T };
  }
}

export type MpPayment = {
  id: number;
  date_created: string;
  date_approved: string | null;
  status: string;
  operation_type: string;
  payment_type_id: string;
  payment_method_id: string;
  transaction_amount: number;
  currency_id: string;
  description: string | null;
  statement_descriptor?: string | null;
  collector_id?: number | null;
  payer?: { id?: string | number | null } | null;
  point_of_interaction?: { type?: string } | null;
  additional_info?: { items?: { title?: string }[] } | null;
};

export type OutgoingRow = { id: string; date: string; amount: number; status: string; kind: string; detail: string };

const fmtRow = (p: MpPayment): OutgoingRow => ({
  id: String(p.id),
  date: p.date_approved ?? p.date_created,
  amount: p.transaction_amount,
  status: p.status,
  kind: `${p.operation_type} · ${p.payment_type_id}/${p.payment_method_id}${p.point_of_interaction?.type ? ` · ${p.point_of_interaction.type}` : ""}`,
  detail: [p.description, p.statement_descriptor, p.additional_info?.items?.[0]?.title].filter(Boolean).join(" · ") || "—",
});

/** Diagnóstico de solo lectura: qué entrega cada vía en el rango */
export async function probeOutgoing(fromIso: string, toIso: string) {
  const me = await mp<{ id: number; site_id: string; nickname?: string }>("/users/me");
  const range = `range=date_created&begin_date=${encodeURIComponent(fromIso)}&end_date=${encodeURIComponent(toIso)}&sort=date_created&criteria=desc&limit=100`;

  let asPayer: { ok: true; total: number; rows: OutgoingRow[]; collectorIsMe: number } | { ok: false; error: string } = { ok: false, error: "sin cuenta" };
  let asCollector: { ok: true; total: number } | { ok: false; error: string } = { ok: false, error: "sin cuenta" };
  if (me.ok) {
    const a = await mp<{ results: MpPayment[]; paging: { total: number } }>(`/v1/payments/search?payer.id=${me.data.id}&${range}`);
    asPayer = a.ok
      ? {
          ok: true,
          total: a.data.paging?.total ?? a.data.results.length,
          // Si el filtro no funciona, vendrían las ventas (donde la tienda cobra)
          collectorIsMe: a.data.results.filter((p) => p.collector_id === me.data.id).length,
          rows: a.data.results.map(fmtRow),
        }
      : { ok: false, error: `${a.status}: ${a.error}` };
    const c = await mp<{ paging: { total: number } }>(`/v1/payments/search?collector.id=${me.data.id}&${range}&limit=1`);
    asCollector = c.ok ? { ok: true, total: c.data.paging?.total ?? 0 } : { ok: false, error: `${c.status}: ${c.error}` };
  }

  // Reporte de liberaciones: listar los ya generados (no crea ninguno)
  const reports = await mp<{ file_name: string; date_created?: string; begin_date?: string; end_date?: string }[]>("/v1/account/release_report/list");
  const settlement = await mp<{ file_name: string }[]>("/v1/account/settlement_report/list");

  return {
    account: me.ok ? { id: me.data.id, site: me.data.site_id } : { error: `${me.status}: ${me.error}` },
    asPayer,
    asCollector,
    releaseReports: reports.ok ? { ok: true as const, files: (Array.isArray(reports.data) ? reports.data : []).slice(0, 5) } : { ok: false as const, error: `${reports.status}: ${reports.error}` },
    settlementReports: settlement.ok ? { ok: true as const, count: Array.isArray(settlement.data) ? settlement.data.length : 0 } : { ok: false as const, error: `${settlement.status}: ${settlement.error}` },
  };
}

/** Pide a Mercado Pago generar el reporte de liberaciones de un rango (se genera en segundo plano) */
export async function requestReleaseReport(fromIso: string, toIso: string) {
  return mp<unknown>("/v1/account/release_report", { method: "POST", body: JSON.stringify({ begin_date: fromIso, end_date: toIso }) });
}

/** Descarga un reporte de liberaciones ya generado y devuelve sus primeras filas (CSV) */
export async function readReleaseReport(fileName: string) {
  const r = await mp<string>(`/v1/account/release_report/${encodeURIComponent(fileName)}`);
  if (!r.ok) return { ok: false as const, error: `${r.status}: ${r.error}` };
  const text = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  const lines = text.split(/\r?\n/).filter(Boolean);
  return { ok: true as const, header: lines[0] ?? "", rows: lines.slice(1, 40), total: Math.max(0, lines.length - 1) };
}
