"use server";

import { createOnlineOrder, type CheckoutInput } from "@/lib/orders";
import { startPayment } from "@/lib/payments";

export type PlaceOrderResult =
  | { ok: true; redirectTo: string }
  | { ok: false; errors: string[] };

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  try {
    const order = await createOnlineOrder(input);
    if (!order.ok) return order;

    const payment = await startPayment(order.orderId);
    // Si el pago no pudo iniciarse, la página del pedido ofrece reintentar
    return { ok: true, redirectTo: payment.ok ? payment.url : `/pedido/${order.orderId}` };
  } catch (e) {
    console.error("[checkout]", (e as Error).message);
    return { ok: false, errors: ["Tuvimos un problema al crear tu pedido. Intenta de nuevo en un momento."] };
  }
}
