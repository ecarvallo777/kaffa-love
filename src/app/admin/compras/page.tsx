import Link from "next/link";
import { connection } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getPurchases, purchasesConfigured, readingSpendSince } from "@/lib/purchases";
import { driveServiceEmail } from "@/lib/google-drive";
import { clp } from "@/lib/catalog-utils";
import { fmtDate, fmtDateTime, startOfMonthChile } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Empty, PageHeader, Pill, Stat, Table, btn } from "@/components/admin/ui";

const usd = (n: number) => `USD ${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: n < 0.1 ? 3 : 2 })}`;
import { syncNow } from "./actions";

export const metadata = { title: "Compras" };
// Leer una factura con Claude puede tomar alrededor de un minuto
export const maxDuration = 300;

const STATUS = {
  pendiente: { label: "Por revisar", tone: "wait" },
  aplicada: { label: "Aplicada", tone: "ok" },
  descartada: { label: "Descartada", tone: "neutral" },
  error: { label: "No se pudo leer", tone: "bad" },
} as const;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ aplicada?: string }> }) {
  await connection();
  await requireStaff(["admin"], "/admin/compras");
  const [purchases, { aplicada }, month] = await Promise.all([getPurchases(), searchParams, readingSpendSince(startOfMonthChile())]);
  const cfg = purchasesConfigured();
  const pending = purchases.filter((p) => p.status === "pendiente").length;
  const priced = purchases.filter((p) => p.usage?.costUsd != null);
  const avgUsd = priced.length ? priced.reduce((s, p) => s + p.usage!.costUsd!, 0) / priced.length : null;

  return (
    <>
      <PageHeader
        title="Compras"
        description="Sube tus facturas de compra (PDF o foto) a la carpeta de Google Drive: se leen solas y aquí confirmas costos, stock y productos nuevos."
        actions={
          cfg.drive && cfg.claude ? (
            <ActionForm action={syncNow}>
              <button className={btn.secondary}>Revisar Drive ahora</button>
            </ActionForm>
          ) : undefined
        }
      />

      {aplicada && (
        <p role="status" className="mb-6 rounded-xl bg-leaf/10 px-3 py-2 text-sm text-leaf">
          {aplicada === "costo" ? "Costos actualizados. El stock no cambió." : "Compra registrada: se actualizaron los costos y el stock."}
        </p>
      )}

      {(!cfg.drive || !cfg.claude) && (
        <Card title="Falta conectar" className="mb-6">
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
            {!cfg.drive && (
              <li>
                Google Drive: configura <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> y <code>DRIVE_FACTURAS_FOLDER</code> (pasos en docs/PRODUCCION.md).
              </li>
            )}
            {!cfg.claude && (
              <li>
                Lectura de facturas: configura <code>ANTHROPIC_API_KEY</code>.
              </li>
            )}
          </ul>
        </Card>
      )}

      {cfg.drive && (
        <p className="mb-6 text-sm text-ink-soft">
          La carpeta se revisa cada pocos minutos. Debe estar compartida (como lector) con <code>{driveServiceEmail()}</code>.
          {pending > 0 && <> Tienes <b>{pending}</b> factura(s) por revisar.</>}
        </p>
      )}

      {month.reads > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Stat
            label="Lectura de facturas este mes"
            value={usd(month.usd)}
            hint={`${month.reads} lectura(s), incluidas las fallidas y los reintentos${month.unknown ? ` · ${month.unknown} sin precio conocido` : ""}. Se descuenta de tu saldo en console.anthropic.com.`}
          />
          {avgUsd !== null && <Stat label="Costo promedio por factura" value={usd(avgUsd)} hint={`Según las ${priced.length} factura(s) de la lista.`} />}
        </div>
      )}

      {purchases.length === 0 ? (
        <Empty>Aún no hay facturas. Sube la primera a la carpeta de Drive.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Documento</th>
              <th>Fecha</th>
              <th className="text-right">Neto</th>
              <th className="text-right">Lectura</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const s = STATUS[p.status];
              return (
                <tr key={p.id}>
                  <td>
                    <span className="font-medium">{p.supplier || p.fileName}</span>
                    {p.supplier && <span className="block text-xs text-ink-mute">{p.fileName}</span>}
                  </td>
                  <td className="capitalize">
                    {p.docType.replace("_", " ")}
                    {p.folio ? ` N° ${p.folio}` : ""}
                  </td>
                  <td>{p.date ? fmtDate(`${p.date}T12:00:00`) : fmtDateTime(p.detectedAt)}</td>
                  <td className="text-right tabular-nums">{p.netTotalClp !== null ? clp(p.netTotalClp) : "—"}</td>
                  <td className="text-right text-ink-soft tabular-nums">{p.usage?.costUsd != null ? usd(p.usage.costUsd) : "—"}</td>
                  <td>
                    <Pill tone={s.tone}>{s.label}</Pill>
                  </td>
                  <td className="text-right">
                    <Link href={`/admin/compras/${encodeURIComponent(p.id)}`} className="text-sm underline underline-offset-4">
                      {p.status === "pendiente" ? "Revisar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
