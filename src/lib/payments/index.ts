import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mercadoPagoConfigured, simulatedPaymentsEnabled, siteUrl } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { confirmOrderPaid, getOrder, preferenceItems } from "@/lib/orders";
import { createPreference, getPayment, searchPaymentsByOrder } from "@/lib/payments/mercadopago";

export type StartPaymentResult = { ok: true; url: string } | { ok: false; error: string };

/** Crea el cobro de un pedido pendiente y devuelve adónde enviar al cliente */
export async function startPayment(orderId: string): Promise<StartPaymentResult> {
  const order = await getOrder(orderId);
  if (!order) return { ok: false, error: "No encontramos el pedido." };
  if (order.status !== "pendiente_pago") return { ok: false, error: "Este pedido ya no está pendiente de pago." };
  if (!order.reserved_until || new Date(order.reserved_until) <= new Date()) {
    return { ok: false, error: "La reserva de este pedido venció. Arma tu carrito de nuevo." };
  }

  if (mercadoPagoConfigured()) {
    const { count } = await createAdminClient()
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("type", "pago_iniciado")
      .eq("entity_id", orderId);
    const customer = order.customers as { email: string; name: string };
    try {
      const pref = await createPreference({
        orderId: order.id,
        orderNumber: order.number,
        items: preferenceItems(order),
        payer: { email: customer.email, name: customer.name },
        expiresAt: new Date(order.reserved_until),
        siteUrl: siteUrl(),
        attempt: (count ?? 0) + 1,
      });
      await createAdminClient().from("orders").update({ mp_preference_id: pref.preferenceId }).eq("id", orderId);
      await logEvent("pago_iniciado", "order", orderId, { proveedor: "mercadopago", preference_id: pref.preferenceId });
      return { ok: true, url: pref.url };
    } catch (e) {
      console.error("[payments]", (e as Error).message);
      return { ok: false, error: "No pudimos conectar con Mercado Pago. Intenta de nuevo en un momento." };
    }
  }

  if (simulatedPaymentsEnabled()) {
    await logEvent("pago_iniciado", "order", orderId, { proveedor: "simulado" });
    return { ok: true, url: `/dev/pago-simulado/${orderId}` };
  }

  return { ok: false, error: "Los pagos todavía no están habilitados. Escríbenos para completar tu compra." };
}

/**
 * Red de seguridad: si un aviso de Mercado Pago se perdió, busca pagos aprobados de un
 * pedido directamente en su API y lo confirma. Devuelve true si encontró uno.
 */
export async function reconcileOrderPayment(orderId: string) {
  if (!mercadoPagoConfigured()) return false;
  const payments = await searchPaymentsByOrder(orderId);
  const approved = payments.find((p) => p.status === "approved");
  if (!approved) return false;
  await syncMercadoPagoPayment(String(approved.id), orderId);
  return true;
}

/**
 * Revisa los pedidos que fueron a pagar y siguen pendientes (o vencieron en las
 * últimas 24 horas) por si Mercado Pago aprobó un pago cuyo aviso no llegó.
 * Se ejecuta antes de liberar reservas.
 */
export async function reconcilePendingPayments() {
  if (!mercadoPagoConfigured()) return 0;
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: orders } = await createAdminClient()
    .from("orders")
    .select("id")
    .eq("channel", "online")
    .not("mp_preference_id", "is", null)
    .or(`status.eq.pendiente_pago,and(status.eq.expirado,updated_at.gte."${since}")`)
    .limit(50);

  let confirmed = 0;
  for (const o of orders ?? []) {
    try {
      if (await reconcileOrderPayment(o.id)) confirmed++;
    } catch (e) {
      console.error("[payments] Conciliación:", (e as Error).message);
    }
  }
  return confirmed;
}

/**
 * Procesa un pago consultándolo SIEMPRE en la API de Mercado Pago:
 * la notificación o la URL de retorno solo dicen "revisa este pago".
 */
export async function syncMercadoPagoPayment(paymentId: string, expectedOrderId?: string) {
  const payment = await getPayment(paymentId);
  if (!payment?.external_reference) return null;
  if (expectedOrderId && payment.external_reference !== expectedOrderId) return null;

  const orderId = payment.external_reference;
  const id = String(payment.id);

  switch (payment.status) {
    case "approved":
      await confirmOrderPaid(orderId, id, payment.transaction_amount);
      break;
    case "rejected":
    case "cancelled":
      // El cliente puede reintentar mientras dure la reserva; al vencer, el cron libera el stock
      await logEventOnce("pago_rechazado", orderId, id, { payment_id: id, detalle: payment.status_detail });
      break;
    case "refunded":
    case "charged_back":
      await logEventOnce("pago_reembolsado", orderId, id, { payment_id: id, estado: payment.status });
      break;
    default:
      await logEventOnce(`pago_actualizado`, orderId, `${id}:${payment.status}`, { payment_id: id, estado: payment.status });
  }
  return payment;
}

/**
 * Registra un evento de pago una sola vez por pago (la página del pedido, el webhook
 * y la conciliación pueden revisar el mismo pago varias veces).
 */
async function logEventOnce(type: string, orderId: string, key: string, data: Record<string, unknown>) {
  const { count } = await createAdminClient()
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .eq("entity_id", orderId)
    .eq("data->>clave", key);
  if (count) return;
  await logEvent(type, "order", orderId, { ...data, clave: key });
}
