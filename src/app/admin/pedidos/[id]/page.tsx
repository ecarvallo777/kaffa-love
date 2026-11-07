import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import type { Grind } from "@/lib/catalog-types";
import { grindLabel } from "@/lib/grinds";
import { EVENT_LABELS, fmtDateTime } from "@/lib/format";
import { getOrder, orderLabel } from "@/lib/orders";
import { ActionForm } from "@/components/admin/action-form";
import { Card, PageHeader, Pill, StatusPill, btn, field } from "@/components/admin/ui";
import { changeOrderStatus, saveTracking } from "../actions";

export default async function OrderDetail({ params }: PageProps<"/admin/pedidos/[id]">) {
  await connection();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const { data: events } = await createAdminClient()
    .from("events")
    .select("id, type, data, created_at")
    .eq("entity_id", id)
    .order("created_at");

  const items = order.order_items as { id: string; product_name: string; unit_price_clp: number; quantity: number; grind: Grind | null }[];
  const customer = order.customers as { name: string; email: string; phone: string } | null;
  const pickup = order.pickup_locations as { name: string; address: string } | null;
  const address = order.shipping_address as Record<string, string | null> | null;
  const isOnline = order.channel === "online";

  const actions: { status: string; label: string; primary?: boolean }[] = [];
  if (isOnline) {
    if (order.status === "pagado") actions.push({ status: "en_preparacion", label: "Marcar en preparación (avisa al cliente)", primary: true });
    if (["pagado", "en_preparacion"].includes(order.status)) {
      if (order.delivery === "retiro") actions.push({ status: "listo_retiro", label: "Listo para retiro (avisa al cliente)", primary: order.status === "en_preparacion" });
    }
    if (["despachado", "listo_retiro"].includes(order.status)) actions.push({ status: "entregado", label: order.delivery === "retiro" ? "Marcar retirado (avisa al cliente)" : "Marcar entregado (avisa al cliente)", primary: true });
  }
  const canCancel = isOnline && ["pendiente_pago", "pagado", "en_preparacion", "listo_retiro"].includes(order.status);
  const canShip = isOnline && order.delivery === "despacho" && ["pagado", "en_preparacion"].includes(order.status);

  return (
    <>
      <Link href="/admin/pedidos" className="text-sm text-ink-soft hover:text-ink">← Pedidos</Link>
      <PageHeader
        title={`Pedido ${orderLabel(order.number)}`}
        description={`${isOnline ? "Online" : "Feria"} · ${fmtDateTime(order.created_at)}`}
        actions={<StatusPill status={order.status} />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card title="Productos">
            <ul className="divide-y divide-line text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-4 py-2.5">
                  <span>
                    <span className="font-medium">{i.quantity} ×</span> {i.product_name}
                    {i.grind && <Pill tone="wait">Molienda {grindLabel(i.grind)?.toLowerCase()}</Pill>}
                  </span>
                  <span className="tabular-nums">{clp(i.unit_price_clp * i.quantity)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2.5 text-ink-soft">
                <span>Envío {order.shipping_service ? `· ${order.shipping_service}` : ""}</span>
                <span className="tabular-nums">{clp(order.shipping_clp)}</span>
              </li>
              <li className="flex justify-between py-2.5 text-base font-medium">
                <span>Total</span>
                <span className="tabular-nums">{clp(order.total_clp)}</span>
              </li>
            </ul>
            {order.mp_payment_id && <p className="mt-2 text-xs text-ink-mute">Pago Mercado Pago: {order.mp_payment_id}</p>}
          </Card>

          {isOnline && (actions.length > 0 || canCancel || canShip) && (
            <Card title="Siguiente paso">
              <div className="flex flex-wrap gap-2">
                {actions.map((a) => (
                  <ActionForm key={a.status} action={changeOrderStatus}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="status" value={a.status} />
                    <button className={a.primary ? btn.primary : btn.secondary}>{a.label}</button>
                  </ActionForm>
                ))}
              </div>
              {canShip && (
                <ActionForm action={changeOrderStatus} className="mt-4 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value="despachado" />
                  <label className="min-w-56 flex-1">
                    <span className="mb-1 block text-sm font-medium">N° de seguimiento Blue Express</span>
                    <input name="tracking" className={field} placeholder="Opcional" />
                  </label>
                  <button className={btn.primary}>Marcar despachado (avisa al cliente)</button>
                </ActionForm>
              )}
              {canCancel && (
                <ActionForm
                  action={changeOrderStatus}
                  className="mt-6 border-t border-line pt-4"
                  confirm="¿Cancelar este pedido? El stock vuelve al inventario. Si estaba pagado, deberás devolver el dinero desde Mercado Pago."
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value="cancelado" />
                  <button className={btn.danger}>Cancelar pedido</button>
                </ActionForm>
              )}
            </Card>
          )}

          {order.status === "despachado" && (
            <Card title="Seguimiento">
              <ActionForm action={saveTracking} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="orderId" value={order.id} />
                <input name="tracking" defaultValue={order.tracking_number ?? ""} className={`${field} max-w-xs`} />
                <button className={btn.secondary}>Guardar</button>
              </ActionForm>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {isOnline && (
            <Card title="Cliente">
              <p className="font-medium">{customer?.name}</p>
              <p className="text-sm"><a href={`mailto:${customer?.email}`} className="underline-offset-4 hover:underline">{customer?.email}</a></p>
              <p className="text-sm"><a href={`tel:${customer?.phone}`} className="underline-offset-4 hover:underline">{customer?.phone}</a></p>
              <div className="mt-4 border-t border-line pt-4 text-sm">
                {order.delivery === "retiro" ? (
                  <p><span className="text-ink-mute">Retira en:</span> {pickup?.name} · {pickup?.address}</p>
                ) : address ? (
                  <p>
                    <span className="text-ink-mute">Despacho a:</span> {address.street} {address.number}
                    {address.apartment ? `, ${address.apartment}` : ""}, {address.commune}, {address.region}
                    {address.notes && <span className="block text-ink-soft">“{address.notes}”</span>}
                  </p>
                ) : null}
              </div>
            </Card>
          )}
          <Card title="Historial">
            <ol className="space-y-3 text-sm">
              {(events ?? []).map((e) => {
                const d = e.data as Record<string, string>;
                return (
                  <li key={e.id} className="flex gap-3">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-ink-mute" />
                    <span>
                      <span className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</span>
                      {d.a && <span className="text-ink-soft"> → {d.a.replace("_", " ")}</span>}
                      {d.nota && <span className="block text-accent-deep">{d.nota}</span>}
                      {d.por && <span className="block text-xs text-ink-mute">{d.por}</span>}
                      <span className="block text-xs text-ink-mute">{fmtDateTime(e.created_at)}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
