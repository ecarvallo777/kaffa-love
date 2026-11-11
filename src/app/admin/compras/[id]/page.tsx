import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireStaff } from "@/lib/auth";
import { getPurchase } from "@/lib/purchases";
import { getProductCosts } from "@/lib/costs";
import { listCategories } from "@/lib/admin-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, PageHeader, Table, btn } from "@/components/admin/ui";
import { discardPurchase, retryPurchase } from "../actions";
import { ReviewForm } from "./review-form";

export const metadata = { title: "Revisar compra" };
export const maxDuration = 300;

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  await requireStaff(["admin"], `/admin/compras/${id}`);
  const p = await getPurchase(decodeURIComponent(id));
  if (!p) notFound();

  const [{ data: products }, costs, categories] = await Promise.all([
    createAdminClient().from("products").select("id, name, type, stock, active").in("type", ["cafe", "accesorio"]).order("name"),
    getProductCosts(),
    listCategories(),
  ]);
  const names = new Map((products ?? []).map((x) => [x.id, x.name]));
  const parent = (c: { parent_id: string | null }) => categories.find((x) => x.id === c.parent_id)?.name;

  return (
    <>
      <PageHeader
        title={p.supplier || p.fileName}
        description={[
          p.docType.replace("_", " "),
          p.folio && `N° ${p.folio}`,
          p.supplierRut && `RUT ${p.supplierRut}`,
          p.date ? fmtDate(`${p.date}T12:00:00`) : null,
          p.netTotalClp !== null && `neto ${clp(p.netTotalClp)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {p.fileUrl && (
              <a href={p.fileUrl} target="_blank" rel="noreferrer" className={btn.secondary}>
                Ver factura
              </a>
            )}
            <Link href="/admin/compras" className={btn.secondary}>
              Volver
            </Link>
          </>
        }
      />

      {p.error && (
        <Card title="No se pudo leer" className="mb-6">
          <p className="text-sm text-ink-soft">{p.error}</p>
          {p.status !== "aplicada" && (
            <ActionForm action={retryPurchase} className="mt-4">
              <input type="hidden" name="id" value={p.id} />
              <button className={btn.secondary}>Volver a leer desde Drive</button>
            </ActionForm>
          )}
        </Card>
      )}

      {p.notes && !p.error && (
        <p className="mb-6 rounded-xl bg-crema/15 px-3 py-2 text-sm text-[#8a5a1c]">
          <b>Nota de la lectura:</b> {p.notes}
        </p>
      )}

      {p.status === "pendiente" ? (
        <>
          <ReviewForm
            purchase={p}
            products={(products ?? []).map((x) => ({ id: x.id, name: x.name, type: x.type, stock: x.stock, active: x.active, cost: costs[x.id] ?? null }))}
            categories={categories.map((c) => ({ id: c.id, name: parent(c) ? `${parent(c)} › ${c.name}` : c.name }))}
          />
          <ActionForm action={discardPurchase} className="mt-10" confirm="¿Descartar esta factura? No se cargará nada.">
            <input type="hidden" name="id" value={p.id} />
            <button className={btn.danger}>Descartar factura</button>
          </ActionForm>
        </>
      ) : (
        p.lines.length > 0 && (
          <Table>
            <thead>
              <tr>
                <th>En la factura</th>
                <th>Producto</th>
                <th className="text-right">Unidades</th>
                <th className="text-right">Costo unitario</th>
                <th className="text-right">Costo que quedó</th>
              </tr>
            </thead>
            <tbody>
              {p.lines.map((l, i) => {
                const a = l.applied && "productId" in l.applied ? l.applied : null;
                return (
                  <tr key={i}>
                    <td>{l.description}</td>
                    <td>{a ? names.get(a.productId) ?? "—" : <span className="text-ink-mute">{l.applied ? "Ignorada" : "—"}</span>}</td>
                    <td className="text-right tabular-nums">{a ? (a.costOnly ? "solo costo" : a.units) : "—"}</td>
                    <td className="text-right tabular-nums">{a ? clp(a.unitCostClp) : "—"}</td>
                    <td className="text-right tabular-nums">{a ? clp(a.costClp) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )
      )}
      {p.appliedAt && (
        <p className="mt-4 text-sm text-ink-mute">
          Aplicada el {fmtDateTime(p.appliedAt)} por {p.appliedBy}.
        </p>
      )}
      {p.usage && (
        <p className="mt-4 text-sm text-ink-mute">
          Lectura: {p.usage.inputTokens.toLocaleString("es-CL")} tokens de entrada y {p.usage.outputTokens.toLocaleString("es-CL")} de salida con{" "}
          {p.usage.model}
          {p.usage.fallback ? " (la terminó un modelo de respaldo)" : ""}
          {p.usage.costUsd !== null ? ` · USD ${p.usage.costUsd.toLocaleString("es-CL", { maximumFractionDigits: 4 })}` : " · precio desconocido"}.
        </p>
      )}
    </>
  );
}
