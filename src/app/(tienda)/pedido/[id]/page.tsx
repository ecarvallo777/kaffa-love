import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clp } from "@/lib/catalog-utils";
import type { Grind } from "@/lib/catalog-types";
import { grindLabel } from "@/lib/grinds";
import { mercadoPagoConfigured } from "@/lib/env";
import { getOrder, orderLabel } from "@/lib/orders";
import { reconcileOrderPayment, syncMercadoPagoPayment } from "@/lib/payments";
import { OrderActions } from "./order-actions";
import { CreateAccountOffer } from "../../cuenta/forms";
import { hoursAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false } };

export default function OrderPage(props: PageProps<"/pedido/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl animate-pulse px-4 pt-16"><div className="h-40 rounded-3xl bg-paper-2" /></div>}>
      <OrderView {...props} />
    </Suspense>
  );
}

type Item = { id: string; product_id: string; product_name: string; unit_price_clp: number; quantity: number; grind: Grind | null };

async function OrderView({ params, searchParams }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  let order = await getOrder(id);
  if (!order || order.channel !== "online") notFound();

  // Volviendo de Mercado Pago: confirmamos el estado consultando su API
  const paymentId = typeof sp.payment_id === "string" ? sp.payment_id : null;
  if (order.status === "pendiente_pago" && mercadoPagoConfigured()) {
    try {
      if (paymentId && paymentId !== "null") {
        await syncMercadoPagoPayment(paymentId, order.id);
      } else if (order.mp_preference_id) {
        // Sin datos de retorno (por ejemplo, cerró la ventana de Mercado Pago):
        // se busca directamente si hay un pago aprobado para este pedido
        await reconcileOrderPayment(order.id);
      }
      order = (await getOrder(id))!;
    } catch (e) {
      console.error("[pedido] No se pudo verificar el pago:", (e as Error).message);
    }
  }
  const lastAttemptFailed = sp.status === "rejected" || sp.collection_status === "rejected" || sp.sim === "rechazado";

  const items = order.order_items as Item[];
  const customer = order.customers as { email: string; name: string; auth_user_id: string | null } | null;
  const paidStatuses = ["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"];
  const canCreateAccount =
    !!customer && !customer.auth_user_id && paidStatuses.includes(order.status) && !!order.paid_at && new Date(order.paid_at) > hoursAgo(48);
  const pickup = order.pickup_locations as { name: string; address: string; hours: string } | null;
  const address = order.shipping_address as { street: string; number: string; apartment?: string | null; commune: string; region: string } | null;
  const reservationActive = order.status === "pendiente_pago" && order.reserved_until && new Date(order.reserved_until) > new Date();

  const hero = statusHero(order.status, order.delivery, lastAttemptFailed);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-14">
      <div className={`rounded-3xl p-6 sm:p-10 ${hero.tone}`}>
        <p className="text-xs tracking-[0.2em] uppercase opacity-80">Pedido {orderLabel(order.number)}</p>
        <h1 className="mt-3 font-display text-3xl leading-tight font-light sm:text-5xl">{hero.title}</h1>
        <p className="mt-3 max-w-xl opacity-85">{hero.text}</p>
        <OrderActions
          orderId={order.id}
          status={order.status}
          reservedUntil={reservationActive ? order.reserved_until : null}
          items={items.map((i) => ({ productId: i.product_id, name: i.product_name, priceClp: i.unit_price_clp, qty: i.quantity, grind: i.grind }))}
        />
      </div>

      {["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"].includes(order.status) && (
        <Progress status={order.status} delivery={order.delivery} />
      )}

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">
            {order.delivery === "retiro" ? "Retiro" : "Despacho"}
          </h2>
          {order.delivery === "retiro" && pickup && (
            <div className="mt-2">
              <p className="font-medium">{pickup.name}</p>
              <p className="text-ink-soft">{pickup.address}</p>
              <p className="text-sm text-ink-mute">{pickup.hours}</p>
            </div>
          )}
          {order.delivery === "despacho" && address && (
            <div className="mt-2 text-ink-soft">
              <p>
                {address.street} {address.number}
                {address.apartment ? `, ${address.apartment}` : ""}
              </p>
              <p>
                {address.commune}, {address.region}
              </p>
              {order.tracking_number && (
                <p className="mt-2 text-ink">
                  Seguimiento Blue Express: <span className="font-medium">{order.tracking_number}</span>
                </p>
              )}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">Contacto</h2>
          <p className="mt-2 text-ink-soft">{customer?.name}</p>
          <p className="text-ink-soft">{customer?.email}</p>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">Detalle</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3">
              <span>
                {i.quantity} × {i.product_name}
                {i.grind && <span className="text-ink-mute"> · molienda {grindLabel(i.grind)?.toLowerCase()}</span>}
              </span>
              <span className="tabular-nums">{clp(i.unit_price_clp * i.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between py-3 text-ink-soft">
            <span>{order.delivery === "retiro" ? "Retiro" : "Despacho"}</span>
            <span className="tabular-nums">{order.shipping_clp ? clp(order.shipping_clp) : "Gratis"}</span>
          </li>
          <li className="flex justify-between py-3 text-lg font-medium">
            <span>Total</span>
            <span className="tabular-nums">{clp(order.total_clp)}</span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-ink-mute">La boleta la emite Mercado Pago y te llega por correo.</p>
      </section>

      {canCreateAccount && customer && <CreateAccountOffer orderId={order.id} email={customer.email} />}

      <p className="mt-10 text-center">
        <Link href="/" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          Volver a la tienda
        </Link>
      </p>
    </div>
  );
}

function statusHero(status: string, delivery: string, lastAttemptFailed: boolean) {
  const ok = "bg-leaf text-paper";
  const wait = "bg-paper-2 text-ink";
  const bad = "bg-ink text-paper";
  switch (status) {
    case "pendiente_pago":
      return lastAttemptFailed
        ? { tone: bad, title: "El pago no se completó", text: "Tus productos siguen reservados. Puedes intentarlo de nuevo con otro medio de pago." }
        : { tone: wait, title: "Esperando tu pago", text: "Tus productos están reservados. Si ya pagaste, la confirmación puede tardar unos segundos." };
    case "pagado":
    case "en_preparacion":
      return { tone: ok, title: "¡Gracias! Tu pago fue aprobado", text: delivery === "retiro" ? "Estamos preparando tu pedido. Te avisaremos por correo cuando puedas retirarlo." : "Estamos preparando tu pedido. Te enviaremos el número de seguimiento cuando salga." };
    case "despachado":
      return { tone: ok, title: "Tu pedido va en camino", text: "Lo entregó Blue Express. Revisa el seguimiento abajo." };
    case "listo_retiro":
      return { tone: ok, title: "Tu pedido está listo para retiro", text: "Te esperamos en el lugar y horario indicados." };
    case "entregado":
      return { tone: ok, title: "Pedido entregado", text: "¡Que disfrutes tu café!" };
    case "expirado":
      return { tone: bad, title: "La reserva venció", text: "Pasaron 30 minutos sin confirmar el pago y liberamos los productos. Puedes volver a armar tu carrito." };
    case "rechazado":
      return { tone: bad, title: "El pago fue rechazado", text: "No se realizó ningún cobro. Puedes volver a intentarlo." };
    default:
      return { tone: bad, title: "Pedido cancelado", text: "Si tienes dudas, escríbenos." };
  }
}

function Progress({ status, delivery }: { status: string; delivery: string }) {
  const steps =
    delivery === "retiro"
      ? [["pagado", "Pagado"], ["en_preparacion", "En preparación"], ["listo_retiro", "Listo para retiro"], ["entregado", "Retirado"]]
      : [["pagado", "Pagado"], ["en_preparacion", "En preparación"], ["despachado", "Despachado"], ["entregado", "Entregado"]];
  const current = steps.findIndex(([s]) => s === status);
  return (
    <ol className="mt-8 grid grid-cols-4 gap-2">
      {steps.map(([s, label], i) => (
        <li key={s} className="text-center">
          <div className={`h-1.5 rounded-full ${i <= current ? "bg-leaf" : "bg-line"}`} />
          <p className={`mt-2 text-xs ${i <= current ? "text-ink" : "text-ink-mute"}`}>{label}</p>
        </li>
      ))}
    </ol>
  );
}
