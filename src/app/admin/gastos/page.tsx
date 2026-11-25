import { connection } from "next/server";
import Link from "next/link";
import { CATEGORIES, getLedger, inspectMovementsReport, listMovementsReports, monthOf, monthlySummary, type LedgerEntry } from "@/lib/expense-ledger";
import { getSheetConfig } from "@/lib/expense-sheet";
import { driveServiceEmail } from "@/lib/google-drive";
import { mpExpensesEnabled } from "@/lib/fair-mp-expenses";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, Pill, btn, field } from "@/components/admin/ui";
import { classifyAction, connectSheetAction, requestMovementsAction, syncNowAction } from "./actions";

export const metadata = { title: "Gastos" };
export const maxDuration = 120;

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const ORIGIN: Record<LedgerEntry["origin"], string> = { feria: "jornada de feria", factura: "factura", regla: "regla", manual: "a mano", pendiente: "pendiente" };
const select = "h-9 rounded-lg border border-line bg-white px-2 text-sm";

function ClassifyForm({ e, label }: { e: LedgerEntry; label: string }) {
  return (
    <ActionForm action={classifyAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={e.id} />
      <select name="category" defaultValue={e.category === "Por clasificar" ? "" : e.category} required className={select} aria-label="Categoría">
        <option value="" disabled>Elige categoría…</option>
        {CATEGORIES.filter((c) => c !== "Por clasificar").map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <input name="note" defaultValue={e.note ?? ""} placeholder="Nota (opcional)" className={`${select} w-48`} />
      <label className="flex items-center gap-1 text-xs text-ink-soft">
        <input type="checkbox" name="remember" defaultChecked /> Recordar este comercio
      </label>
      <button className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-accent">{label}</button>
    </ActionForm>
  );
}

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/gastos">) {
  await connection();
  const sp = await searchParams;
  const [{ entries, syncedAt }, sheet, { data: sessions }] = await Promise.all([getLedger(), getSheetConfig(), createAdminClient().from("fair_sessions").select("id, name")]);
  const fairName = new Map((sessions ?? []).map((s) => [s.id, s.name as string]));
  const months = [...new Set(entries.map((e) => monthOf(e.date)))].sort().reverse();
  const month = typeof sp.mes === "string" && months.includes(sp.mes) ? sp.mes : months[0];
  const rows = entries.filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date));
  const pending = rows.filter((e) => e.category === "Por clasificar");
  const done = rows.filter((e) => e.category !== "Por clasificar");
  const totals = month ? [...(monthlySummary(entries).get(month)?.entries() ?? [])].sort((a, b) => b[1] - a[1]) : [];
  const total = totals.reduce((s, [, v]) => s + v, 0);
  const allPending = entries.filter((e) => e.category === "Por clasificar").length;

  // Segunda etapa: reporte de movimientos (transferencias y retiros)
  let reports: Awaited<ReturnType<typeof listMovementsReports>> = [];
  let reportError: string | null = null;
  let inspected: Awaited<ReturnType<typeof inspectMovementsReport>> | null = null;
  if (mpExpensesEnabled()) {
    reports = await listMovementsReports().catch((e: Error) => ((reportError = e.message), []));
    if (typeof sp.reporte === "string") inspected = await inspectMovementsReport(sp.reporte).catch((e: Error) => ((reportError = e.message), null));
  }

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Todo lo que sale de la cuenta de Mercado Pago, clasificado. Los pagos en días de feria y los que calzan con una factura de Compras se clasifican solos; lo nuevo queda por clasificar."
        actions={
          <ActionForm action={syncNowAction}>
            <button className={btn.secondary}>Leer Mercado Pago ahora</button>
          </ActionForm>
        }
      />
      <p className="mb-6 text-sm text-ink-soft">
        Última lectura: {syncedAt ? fmtDateTime(syncedAt) : "nunca"} · se lee sola una vez al día · desde noviembre de 2026
        {allPending > 0 && <> · <b className="text-danger-deep">{allPending} por clasificar</b></>}
      </p>

      {months.length > 0 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Meses">
          {months.map((m) => (
            <Link key={m} href={`/admin/gastos?mes=${m}`} className={`rounded-full px-3 py-1.5 text-sm capitalize ${m === month ? "bg-ink text-paper" : "border border-line bg-white/60"}`}>
              {monthName(m)}
            </Link>
          ))}
        </nav>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {pending.length > 0 && (
            <Card title={`Por clasificar (${pending.length})`}>
              <ul className="divide-y divide-line">
                {pending.map((e) => (
                  <li key={e.id} className="py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm"><span className="font-medium">{e.detail}</span><span className="text-ink-mute"> · {fmtDateTime(e.date)}</span></p>
                      <p className="font-medium tabular-nums">{clp(e.amountClp)}</p>
                    </div>
                    <ClassifyForm e={e} label="Clasificar" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={month ? `Movimientos de ${monthName(month)}` : "Movimientos"}>
            {done.length ? (
              <ul className="divide-y divide-line">
                {done.map((e) => (
                  <li key={e.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 text-sm">
                        <span className={e.category === "No es gasto" ? "text-ink-mute" : ""}>{e.detail}</span>
                        <span className="text-ink-mute"> · {fmtDateTime(e.date)}</span>
                        {e.sessionId && <span className="block text-xs text-ink-mute">Feria: {fairName.get(e.sessionId) ?? "—"}</span>}
                        {e.purchaseId && <Link href={`/admin/compras/${encodeURIComponent(e.purchaseId)}`} className="block text-xs text-accent underline-offset-4 hover:underline">Ver factura</Link>}
                        {e.note && <span className="block text-xs text-ink-soft">{e.note}</span>}
                      </p>
                      <div className="flex items-center gap-2">
                        <Pill tone={e.category === "No es gasto" ? "neutral" : "ok"}>{e.category}</Pill>
                        <span className="text-xs text-ink-mute">{ORIGIN[e.origin]}</span>
                        <span className={`tabular-nums ${e.category === "No es gasto" ? "text-ink-mute line-through" : "font-medium"}`}>{clp(e.amountClp)}</span>
                      </div>
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-ink-mute hover:text-ink">Cambiar</summary>
                      <ClassifyForm e={e} label="Guardar" />
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-mute">{entries.length ? "Sin movimientos clasificados este mes." : "Aún no hay gastos. Presiona «Leer Mercado Pago ahora»."}</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title={month ? `Total de ${monthName(month)}` : "Total"}>
            <p className="font-display text-3xl tabular-nums">{clp(total)}</p>
            <ul className="mt-3 space-y-1 text-sm">
              {totals.map(([c, v]) => (
                <li key={c} className="flex justify-between gap-2">
                  <span className={c === "Por clasificar" ? "text-danger-deep" : ""}>{c}</span>
                  <span className="tabular-nums">{clp(v)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-mute">No incluye lo marcado como «No es gasto» (retiros, compras personales).</p>
          </Card>

          <Card title="Planilla de Google Sheets">
            {sheet ? (
              <div className="text-sm">
                <p>
                  <a href={`https://docs.google.com/spreadsheets/d/${sheet.id}`} target="_blank" rel="noreferrer" className="font-medium text-accent underline-offset-4 hover:underline">{sheet.title ?? "Abrir planilla"}</a>
                </p>
                <p className="mt-1 text-xs text-ink-mute">Una hoja por mes y un resumen · actualizada {sheet.syncedAt ? fmtDateTime(sheet.syncedAt) : "nunca"}</p>
                {sheet.error && <p className="mt-2 text-sm text-danger-deep">{sheet.error}</p>}
              </div>
            ) : (
              <>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
                  <li>En Google Cloud (proyecto de la cuenta de servicio), habilita la <b>Google Sheets API</b>.</li>
                  <li>En el Drive de la tienda crea una planilla de Google Sheets vacía, por ejemplo «Gastos Kaffa Love».</li>
                  <li>Compártela como <b>Editor</b> con <code className="break-all">{driveServiceEmail() ?? "la cuenta de servicio"}</code>.</li>
                  <li>Pega aquí su enlace.</li>
                </ol>
                <ActionForm action={connectSheetAction} className="mt-3 flex flex-wrap items-end gap-2">
                  <Field label="Enlace de la planilla" className="min-w-0 flex-1">
                    <input name="url" required className={field} placeholder="https://docs.google.com/spreadsheets/d/…" />
                  </Field>
                  <button className={btn.primary}>Conectar</button>
                </ActionForm>
              </>
            )}
          </Card>

          <Card title="Transferencias y retiros (en preparación)">
            <p className="text-sm text-ink-soft">
              Las transferencias (a proveedores o a tu banco) no aparecen como pagos: vienen en el reporte de movimientos de Mercado Pago. Pídelo una vez para revisar su formato y sumarlas al libro.
            </p>
            {reportError && <p className="mt-2 text-sm text-danger-deep">{reportError}</p>}
            {reports.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {reports.map((r) => (
                  <li key={r.file_name}>
                    <Link href={`/admin/gastos?${month ? `mes=${month}&` : ""}reporte=${encodeURIComponent(r.file_name)}`} className="text-accent underline-offset-4 hover:underline">{r.file_name}</Link>
                  </li>
                ))}
              </ul>
            )}
            {inspected && (
              <div className="mt-3 rounded-xl bg-paper-2 p-3 text-xs">
                <p><b>{inspected.rows}</b> filas · columnas:</p>
                <p className="mt-1 font-mono break-all">{inspected.header.join(" · ")}</p>
                <p className="mt-2">Tipos: {inspected.types.map(([t, n]) => `${t || "(vacío)"} (${n})`).join(", ")}</p>
              </div>
            )}
            {mpExpensesEnabled() && (
              <ActionForm action={requestMovementsAction} className="mt-3">
                <button className={btn.secondary}>Pedir reporte de movimientos</button>
              </ActionForm>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
