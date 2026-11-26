"use server";

import { cookies, headers } from "next/headers";
import { createOnlineOrder, type CheckoutInput } from "@/lib/orders";
import { startPayment } from "@/lib/payments";
import { CONSENT_COOKIE, saveAttribution } from "@/lib/marketing/meta-pixel";

export type PlaceOrderResult =
  | { ok: true; redirectTo: string }
  | { ok: false; errors: string[]; code?: "bienvenida_usada" };

export async function placeOrder(input: CheckoutInput): Promise<PlaceOrderResult> {
  try {
    const order = await createOnlineOrder(input);
    if (!order.ok) return order;

    // Anuncios de Meta: solo si aceptó las cookies de publicidad en la tienda
    const jar = await cookies();
    if (jar.get(CONSENT_COOKIE)?.value === "si") {
      const h = await headers();
      await saveAttribution(order.orderId, {
        fbp: jar.get("_fbp")?.value ?? null,
        fbc: jar.get("_fbc")?.value ?? null,
        ua: h.get("user-agent")?.slice(0, 400) ?? null,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      });
    }

    const payment = await startPayment(order.orderId);
    // Si el pago no pudo iniciarse, la página del pedido ofrece reintentar
    return { ok: true, redirectTo: payment.ok ? payment.url : `/pedido/${order.orderId}` };
  } catch (e) {
    console.error("[checkout]", (e as Error).message);
    return { ok: false, errors: ["Tuvimos un problema al crear tu pedido. Intenta de nuevo en un momento."] };
  }
}
