import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProducts } from "@/lib/admin-data";
import { fmtDateTime } from "@/lib/format";
import { orderLabel } from "@/lib/orders";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, LinkButton, PageHeader, Pill, Table, btn, field } from "@/components/admin/ui";
import { adjustStockAction } from "./actions";

export const metadata = { title: "Stock" };

const REASONS: Record<string, string> = {
  pedido: "Venta",
  liberacion: "Reserva liberada",
  compra: "Compra",
  ajuste: "Ajuste",
  migracion: "Migración",
  inicio_jornada: "Inicio de jornada",
};

export default async function StockPage() {
  await connection();
  const products = (await listProducts()).filter((p) => p.track_stock && p.active);
  const { data: movements } = await createAdminClient()
    .from("stock_movements")
    .select("id, delta, reason, note, created_at, products (name), orders (id, number)")
    .order("created_at", { ascending: false })
    .limit(60);

  return (
    <>
      <PageHeader
        title="Stock"
        description="Inventario compartido entre la tienda y las ferias. Cada cambio queda registrado con su motivo."
        actions={<LinkButton href="/admin/compras">Cargar compras desde Excel</LinkButton>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="space-y-6">
          <Card title="Ajustar stock">
            <ActionForm action={adjustStockAction} resetOnSuccess className="grid gap-4 sm:grid-cols-2">
              <Field label="Producto" className="sm:col-span-2">
                <select name="productId" required className={field}>
                  <option value="">Elige un producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · hay {p.stock}</option>
                  ))}
                </select>
              </Field>
              <Field label="Operación">
                <select name="mode" className={field}>
                  <option value="sumar">Sumar unidades</option>
                  <option value="restar">Restar unidades</option>
                </select>
              </Field>
              <Field label="Cantidad"><input name="qty" type="number" min={1} required className={field} /></Field>
              <Field label="Motivo">
                <select name="reason" className={field}>
                  <option value="compra">Compra / reposición</option>
                  <option value="ajuste">Ajuste (conteo, merma, daño)</option>
                </select>
              </Field>
              <Field label="Nota"><input name="note" className={field} placeholder="Obligatoria en ajustes" /></Field>
              <div className="sm:col-span-2"><button className={btn.primary}>Guardar movimiento</button></div>
            </ActionForm>
          </Card>
          <Card title="Inventario">
            <ul className="divide-y divide-line text-sm">
              {products.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/productos/${p.id}`} className="truncate hover:underline">{p.name}</Link>
                  <span className={`tabular-nums ${p.stock <= p.low_stock_threshold ? "font-medium text-accent-deep" : ""}`}>{p.stock}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl">Últimos movimientos</h2>
          <Table>
            <thead>
              <tr><th>Fecha</th><th>Producto</th><th>Motivo</th><th className="text-right">Cambio</th></tr>
            </thead>
            <tbody>
              {(movements ?? []).map((m) => {
                const order = m.orders as unknown as { id: string; number: number } | null;
                return (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap text-ink-soft">{fmtDateTime(m.created_at)}</td>
                    <td>{(m.products as unknown as { name: string })?.name}</td>
                    <td>
                      <Pill tone={m.reason === "pedido" ? "info" : m.reason === "liberacion" ? "wait" : "neutral"}>{REASONS[m.reason] ?? m.reason}</Pill>
                      {order && <Link href={`/admin/pedidos/${order.id}`} className="ml-2 text-xs underline">{orderLabel(order.number)}</Link>}
                      {m.note && <span className="block text-xs text-ink-mute">{m.note}</span>}
                    </td>
                    <td className={`text-right font-medium tabular-nums ${m.delta > 0 ? "text-leaf" : "text-accent-deep"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>
    </>
  );
}
