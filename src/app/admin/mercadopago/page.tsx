import { connection } from "next/server";
import Link from "next/link";
import { probeOutgoing, readReleaseReport } from "@/lib/payments/mp-movements";
import { mercadoPagoConfigured } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";
import { clp } from "@/lib/catalog-utils";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Empty, PageHeader, Pill, Table, btn, field } from "@/components/admin/ui";
import { requestReport } from "./actions";

export const metadata = { title: "Mercado Pago · diagnóstico" };

const day = (d: Date) => d.toISOString().slice(0, 10);
/** Rango por defecto: los últimos 30 días */
function defaultRange() {
  return { from: day(new Date(Date.now() - 30 * 86400_000)), to: day(new Date()) };
}

/**
 * Diagnóstico de solo lectura: qué pagos HECHOS por la cuenta entrega Mercado Pago,
 * para luego registrarlos solos como gastos de feria. No modifica nada en la tienda.
 */
export default async function MercadoPagoPage({ searchParams }: PageProps<"/admin/mercadopago">) {
  await connection();
  const sp = await searchParams;
  if (!mercadoPagoConfigured()) return <Empty>Falta MP_ACCESS_TOKEN en este entorno.</Empty>;
  const range = defaultRange();
  const to = typeof sp.hasta === "string" ? sp.hasta : range.to;
  const from = typeof sp.desde === "string" ? sp.desde : range.from;
  const fromIso = `${from}T00:00:00.000-03:00`;
  const toIso = `${to}T23:59:59.999-03:00`;
  const [probe, report] = await Promise.all([
    probeOutgoing(fromIso, toIso),
    typeof sp.archivo === "string" ? readReleaseReport(sp.archivo) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Mercado Pago · diagnóstico"
        description="Solo lectura. Muestra qué pagos hechos por la cuenta (Uber, comida, insumos) entrega Mercado Pago, para registrarlos solos como gastos de feria."
      />
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Desde
          <input type="date" name="desde" defaultValue={from} className={field} />
        </label>
        <label className="text-sm">
          Hasta
          <input type="date" name="hasta" defaultValue={to} className={field} />
        </label>
        <button className={btn.secondary}>Consultar</button>
      </form>

      <div className="space-y-6">
        <Card title="Cuenta">
          <p className="text-sm">{"error" in probe.account ? <span className="text-danger-deep">{probe.account.error}</span> : `Cuenta ${probe.account.id} (${probe.account.site})`}</p>
          <p className="mt-1 text-sm text-ink-soft">
            Cobros (ventas) en el rango: {probe.asCollector.ok ? probe.asCollector.total : <span className="text-danger-deep">{probe.asCollector.error}</span>}
          </p>
        </Card>

        <Card title="Vía A · pagos donde la tienda es quien paga">
          {!probe.asPayer.ok ? (
            <p className="text-sm text-danger-deep">{probe.asPayer.error}</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                {probe.asPayer.total} pagos encontrados.
                {probe.asPayer.collectorIsMe > 0 && (
                  <> <Pill tone="bad">{probe.asPayer.collectorIsMe} son ventas</Pill> (el filtro no funcionó: trae cobros, no gastos)</>
                )}
              </p>
              {probe.asPayer.rows.length > 0 && (
                <Table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Monto</th>
                      <th>Estado</th>
                      <th>Tipo</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {probe.asPayer.rows.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap">{fmtDateTime(r.date)}</td>
                        <td className="tabular-nums">{clp(r.amount)}</td>
                        <td>{r.status}</td>
                        <td className="text-xs text-ink-mute">{r.kind}</td>
                        <td className="text-sm">{r.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </>
          )}
        </Card>

        <Card title="Vía B · reporte de liberaciones (todos los movimientos del dinero en cuenta)">
          {!probe.releaseReports.ok ? (
            <p className="text-sm text-danger-deep">{probe.releaseReports.error}</p>
          ) : (
            <>
              <p className="text-sm text-ink-soft">Reportes ya generados: {probe.releaseReports.files.length || "ninguno"}.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {probe.releaseReports.files.map((f) => (
                  <li key={f.file_name}>
                    <Link href={`/admin/mercadopago?desde=${from}&hasta=${to}&archivo=${encodeURIComponent(f.file_name)}`} className="text-accent underline-offset-4 hover:underline">
                      {f.file_name}
                    </Link>
                    {f.begin_date && <span className="text-ink-mute"> · {f.begin_date.slice(0, 10)} a {f.end_date?.slice(0, 10)}</span>}
                  </li>
                ))}
              </ul>
              <ActionForm action={requestReport} className="mt-4">
                <input type="hidden" name="desde" value={fromIso} />
                <input type="hidden" name="hasta" value={toIso} />
                <button className={btn.secondary}>Generar reporte del rango</button>
                <span className="ml-3 text-xs text-ink-mute">Mercado Pago lo prepara en unos minutos; después recarga la página.</span>
              </ActionForm>
            </>
          )}
          <p className="mt-3 text-xs text-ink-mute">Reporte de dinero en cuenta: {probe.settlementReports.ok ? `${probe.settlementReports.count} generados` : probe.settlementReports.error}</p>
        </Card>

        {report && (
          <Card title={`Reporte ${String(sp.archivo)}`}>
            {!report.ok ? (
              <p className="text-sm text-danger-deep">{report.error}</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-ink-soft">{report.total} filas. Columnas:</p>
                <p className="mb-3 rounded-xl bg-paper-2 p-3 font-mono text-xs break-all">{report.header}</p>
                <pre className="max-h-[480px] overflow-auto rounded-xl bg-white p-3 text-xs">{report.rows.join("\n")}</pre>
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
