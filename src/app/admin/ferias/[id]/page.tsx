import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { getFairProfits } from "@/lib/fair-profit";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader, Pill, Table } from "@/components/admin/ui";
import { ExpensesEditor } from "../expenses-editor";

export const metadata = { title: "Detalle de feria" };

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)} %`);

export default async function FairDetailPage({ params }: PageProps<"/admin/ferias/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: session }, profits, settings] = await Promise.all([
    createAdminClient().from("fair_sessions").select("*").eq("id", id).maybeSingle(),
    getFairProfits([id]),
    getSettings(),
  ]);
  if (!session) notFound();
  const fp = profits.get(id)!;
  const p = fp.profit;
  const point = session.point_total_clp as number | null;

  const lines: [string, number, string?][] = [
    ["Ventas (con IVA)", p.gross],
    [`IVA (${settings.ivaPct} %)`, -p.iva, "Se paga al SII"],
    ["Ventas netas", p.net],
    ["Costo de los productos vendidos", -p.productCost, "Costo neto de cada producto"],
    [`Comisión Mercado Pago Point (${settings.mpFeriaPct} %)`, -p.commission],
    ["Gastos de la jornada", -p.expenses, "Stand, transporte, comida…"],
  ];

  return (
    <>
      <Link href="/admin/ferias" className="text-sm text-ink-soft hover:text-ink">← Ferias</Link>
      <PageHeader
        title={session.name}
        description={`${session.location ? `${session.location} · ` : ""}${fmtDateTime(session.opened_at)}${session.closed_at ? ` a ${fmtDateTime(session.closed_at)}` : " · abierta"}`}
        actions={session.closed_at ? null : <Pill tone="wait">Jornada abierta</Pill>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card title="Utilidad real">
            <dl className="divide-y divide-line text-sm">
              {lines.map(([label, value, hint]) => (
                <div key={label} className={`flex items-baseline justify-between gap-4 py-2.5 ${label === "Ventas netas" ? "font-medium" : ""}`}>
                  <dt>
                    {label}
                    {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
                  </dt>
                  <dd className={`tabular-nums ${value < 0 ? "text-ink-soft" : ""}`}>{value < 0 ? `− ${clp(-value)}` : clp(Math.abs(value))}</dd>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 pt-4">
                <dt className="font-display text-xl">Utilidad</dt>
                <dd className={`font-display text-3xl tabular-nums ${p.profit < 0 ? "text-accent-deep" : "text-leaf"}`}>{clp(p.profit)}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-xl bg-paper-2 p-3">
                <p className="text-xs text-ink-mute">Margen</p>
                <p className="font-display text-xl">{p.missingCost.length ? "—" : pct(p.margin)}</p>
              </div>
              <div className="rounded-xl bg-paper-2 p-3">
                <p className="text-xs text-ink-mute">Ventas</p>
                <p className="font-display text-xl tabular-nums">{p.orders}</p>
              </div>
              <div className="rounded-xl bg-paper-2 p-3">
                <p className="text-xs text-ink-mute">Utilidad por hora</p>
                <p className="font-display text-xl tabular-nums">{fp.hours ? clp(Math.round(p.profit / fp.hours)) : "—"}</p>
              </div>
            </div>
            {p.missingCost.length > 0 && (
              <p className="mt-4 rounded-xl bg-crema/15 px-3 py-2 text-sm text-[#8a5a1c]">
                Sin costo ingresado (se cuenta como $0): {p.missingCost.join(", ")}.{" "}
                <Link href="/admin/productos" className="underline">Completar en Productos</Link>
              </p>
            )}
            {settings.mpFeriaPct === 0 && (
              <p className="mt-2 rounded-xl bg-crema/15 px-3 py-2 text-sm text-[#8a5a1c]">
                La comisión de Point está en 0 %. <Link href="/admin/configuracion" className="underline">Configúrala</Link> para ver la utilidad real.
              </p>
            )}
            {point !== null && point !== p.gross && (
              <p className="mt-2 text-xs text-ink-mute">
                Total informado por Point al cierre: {clp(point)} (diferencia {clp(point - p.gross)}).
              </p>
            )}
            <p className="mt-3 text-xs text-ink-mute">
              Cálculo con costos netos y el IVA de las ventas; valida con tu contador cómo se recupera el IVA de las compras.
            </p>
          </Card>

          <Card title="Gastos de la jornada">
            <ExpensesEditor sessionId={id} initial={fp.expenses} />
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl">Qué se vendió</h2>
          {fp.products.length ? (
            <Table>
              <thead>
                <tr><th>Producto</th><th className="text-right">Unid.</th><th className="text-right">Ventas</th><th className="text-right">Costo</th><th className="text-right">Margen</th></tr>
              </thead>
              <tbody>
                {fp.products.map((x) => {
                  const net = x.revenue / (1 + settings.ivaPct / 100);
                  const m = x.cost === null || net <= 0 ? null : (net - x.cost) / net;
                  return (
                    <tr key={x.productId}>
                      <td>{x.name}</td>
                      <td className="text-right tabular-nums">{x.units}</td>
                      <td className="text-right tabular-nums">{clp(x.revenue)}</td>
                      <td className="text-right tabular-nums">{x.cost === null ? <span className="text-ink-mute">sin costo</span> : clp(x.cost)}</td>
                      <td className={`text-right tabular-nums ${m !== null && m < 0.2 ? "text-accent-deep" : ""}`}>{pct(m)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-soft">Aún no hay ventas en esta jornada.</p>
          )}
          <p className="mt-2 text-xs text-ink-mute">Margen bruto por producto: ventas sin IVA menos su costo, antes de comisión y gastos.</p>
        </div>
      </div>
    </>
  );
}
