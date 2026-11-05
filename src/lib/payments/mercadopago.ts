import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Mercado Pago Checkout Pro mediante su API REST.
 * Docs: https://www.mercadopago.cl/developers/es/docs/checkout-pro
 *
 * Variables:
 *   MP_ACCESS_TOKEN    Access token de producción (o de prueba) de la cuenta
 *   MP_WEBHOOK_SECRET  Clave secreta de las notificaciones (Webhooks)
 */

const API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("Falta MP_ACCESS_TOKEN");
  return t;
}

export type PreferenceItem = { id: string; title: string; quantity: number; unitPriceClp: number };

export async function createPreference(input: {
  orderId: string;
  orderNumber: number;
  items: PreferenceItem[];
  payer: { email: string; name: string };
  expiresAt: Date;
  siteUrl: string;
  attempt: number;
}) {
  const https = input.siteUrl.startsWith("https://");
  const backUrl = `${input.siteUrl}/pedido/${input.orderId}`;

  const body = {
    items: input.items.map((i) => ({
      id: i.id,
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unitPriceClp,
      currency_id: "CLP",
    })),
    payer: { email: input.payer.email, name: input.payer.name },
    external_reference: input.orderId,
    metadata: { order_id: input.orderId, order_number: input.orderNumber },
    back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
    // Mercado Pago solo acepta retorno automático y avisos hacia URLs públicas https
    ...(https
      ? { auto_return: "approved", notification_url: `${input.siteUrl}/api/webhooks/mercadopago` }
      : {}),
    // Solo aprobado o rechazado: no hay pagos "pendientes" que excedan la reserva de stock
    binary_mode: true,
    expires: true,
    expiration_date_from: new Date().toISOString(),
    expiration_date_to: input.expiresAt.toISOString(),
    statement_descriptor: "KAFFA LOVE",
  };

  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${input.orderId}-${input.attempt}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Mercado Pago rechazó la preferencia (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string; init_point: string; sandbox_init_point: string };
  return { preferenceId: data.id, url: data.init_point };
}

export type MpPayment = {
  id: number;
  status: string; // approved | rejected | cancelled | refunded | charged_back | in_process | pending
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  date_approved: string | null;
};

export async function getPayment(paymentId: string): Promise<MpPayment | null> {
  const res = await fetch(`${API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`No se pudo consultar el pago ${paymentId} (${res.status})`);
  return res.json();
}

/**
 * Verifica la firma de una notificación (cabecera x-signature).
 * https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks
 */
export function verifyWebhookSignature(opts: {
  signature: string | null;
  requestId: string | null;
  dataId: string;
}) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true; // Sin clave configurada se confía igual en la consulta a la API
  if (!opts.signature) return false;

  const parts = Object.fromEntries(
    opts.signature.split(",").map((p) => p.split("=").map((s) => s.trim()) as [string, string]),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const id = /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  let manifest = `id:${id};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
