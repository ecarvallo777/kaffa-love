import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomerCart } from "@/lib/customer-cart-link";
import { clp } from "@/lib/catalog-utils";
import { fmtDate, fmtDateTime, ORDER_STATUS } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, Pill, StatusPill, Table, btn, field, textarea } from "@/components/admin/ui";
import { CartEditor } from "../cart-editor";
import { deleteCustomerDataAction, sendCartAction } from "../actions";

export const metadata = { title: "Cliente" };

export default async function CustomerPage({ params, searchParams }: PageProps<"/admin/clientes/[id]">) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: c }, { data: addresses }, { data: orders }, { data: products }, cart, { data: events }] = await Promise.all([
    db.from("customers").select("*").eq("id", id).maybeSingle(),
    db.from("addresses").select("street, number, apartment, commune, region").eq("customer_id", id),
    db.from("orders").select("id, number, status, channel, total_clp, created_at").eq("customer_id", id).order("created_at", { ascending: false }).limit(20),
    db.from("products").select("id, name, type, price_clp, track_stock, stock").eq("active", true).in("type", ["cafe", "accesorio", "promocion"]).order("name"),
    getCustomerCart(id),
    db.from("events").select("type, created_at, data").eq("entity_id", id).in("type", ["carrito_enviado", "acceso_carrito"]).order("created_at", { ascending: false }).limit(5),
  ]);
  if (!c) notFound();

  return (
    <>
      <Link href="/admin/clientes" className="text-sm text-ink-soft hover:text-ink">← Clientes</Link>
      <PageHeader
        title={c.name || c.email}
        description={[c.email, c.phone].filter(Boolean).join(" · ")}
        actions={
          <div className="flex flex-wrap gap-1">
            {c.auth_user_id ? <Pill tone="ok">Con cuenta</Pill> : <Pill>Sin cuenta</Pill>}
            {c.marketing_consent && <Pill tone="info">Acepta novedades</Pill>}
          </div>
        }
      />
      {sp.ya && <p className="mb-4 rounded-xl bg-crema/15 px-3 py-2 text-sm text-[#8a5a1c]">Ese correo ya era cliente: esta es su ficha.</p>}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <Card title="1. Armar su carrito">
            <p className="mb-4 text-sm text-ink-soft">Es el mismo carrito que ve el cliente al entrar a su cuenta. Los precios y el stock se validan de nuevo al pagar.</p>
            <CartEditor
              customerId={c.id}
              products={(products ?? []).map((p) => ({ id: p.id, name: p.name, type: p.type, priceClp: p.price_clp, stock: p.track_stock ? p.stock : null }))}
              initial={cart.map((l) => ({ productId: l.productId, qty: l.qty, grind: l.grind }))}
            />
          </Card>

          <Card title="2. Enviárselo para que pague">
            {cart.length ? (
              <ActionForm action={sendCartAction} confirm={`¿Enviar el carrito a ${c.email}?`} className="space-y-3">
                <input type="hidden" name="customerId" value={c.id} />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Mensaje (opcional)</span>
                  <textarea name="note" rows={3} className={textarea} placeholder="Hola, te dejé listo el pedido que conversamos…" />
                </label>
                <p className="text-xs text-ink-mute">
                  Le llega un correo con el carrito y el botón «Revisar y pagar»: entra directo a su cuenta y al pago, sin contraseña (vale 7 días).
                  {!c.auth_user_id && " Como aún no tiene cuenta, se le crea al enviar."}
                </p>
                <button className={btn.primary}>Enviar correo</button>
              </ActionForm>
            ) : (
              <p className="text-sm text-ink-mute">Primero guarda un carrito.</p>
            )}
            {(events ?? []).length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-line pt-3 text-xs text-ink-mute">
                {(events ?? []).map((e, i) => (
                  <li key={i}>
                    {fmtDateTime(e.created_at)} · {e.type === "carrito_enviado" ? `Carrito enviado (${clp(Number((e.data as { subtotal?: number }).subtotal ?? 0))})` : "Entró con el enlace del correo"}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Pedidos">
            {orders?.length ? (
              <Table>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Link href={`/admin/pedidos/${o.id}`} className="font-medium underline-offset-4 hover:underline">#{o.number}</Link>
                        <span className="block text-xs text-ink-mute">{fmtDate(o.created_at)} · {o.channel}</span>
                      </td>
                      <td className="text-right tabular-nums">{clp(o.total_clp)}</td>
                      <td>{ORDER_STATUS[o.status] ? <StatusPill status={o.status} /> : o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="text-sm text-ink-mute">Aún no tiene pedidos.</p>
            )}
          </Card>
          <Card title="Direcciones">
            {addresses?.length ? (
              <ul className="space-y-1 text-sm">
                {addresses.map((a, i) => (
                  <li key={i}>
                    {a.street} {a.number}
                    {a.apartment ? `, ${a.apartment}` : ""} · {a.commune}, {a.region}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-mute">Sin direcciones guardadas.</p>
            )}
          </Card>
          <Card title="Solicitudes sobre sus datos">
            <p className="text-sm text-ink-soft">
              Si el cliente pide ver, llevarse o borrar sus datos (Ley 21.719), respóndele dentro de <b>30 días corridos</b>.
            </p>
            <a href={`/admin/clientes/${c.id}/datos`} className={`${btn.secondary} mt-3`}>Descargar sus datos (JSON)</a>
            <p className="mt-1 text-xs text-ink-mute">Para acceso o portabilidad: envíale el archivo adjunto desde contacto@.</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-danger-deep">Eliminar sus datos</summary>
              <p className="mt-2 text-sm text-ink-soft">
                Borra nombre, correo, teléfono, direcciones, su cuenta y su carrito. Los pedidos se conservan sin datos personales (la ley tributaria obliga a
                guardar las ventas por 6 años). No se puede deshacer.
              </p>
              <ActionForm action={deleteCustomerDataAction} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <Field label="Escribe ELIMINAR" className="w-40">
                  <input name="confirm" autoComplete="off" required className={field} />
                </Field>
                <button className={btn.danger}>Eliminar datos</button>
              </ActionForm>
            </details>
          </Card>
          <p className="text-xs text-ink-mute">Cliente desde {fmtDate(c.created_at)}{c.source === "prestashop" ? " (tienda anterior)" : ""}.</p>
        </div>
      </div>
    </>
  );
}
