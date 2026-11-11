import Link from "next/link";
import { connection } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getPurchases, purchasesConfigured } from "@/lib/purchases";
import { driveServiceEmail } from "@/lib/google-drive";
import { clp } from "@/lib/catalog-utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Empty, PageHeader, Pill, Table, btn } from "@/components/admin/ui";
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
  const [purchases, { aplicada }] = await Promise.all([getPurchases(), searchParams]);
  const cfg = purchasesConfigured();
  const pending = purchases.filter((p) => p.status === "pendiente").length;

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
          Compra registrada: se actualizaron los costos y el stock.
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
