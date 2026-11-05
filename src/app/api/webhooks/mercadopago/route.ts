import { NextResponse, type NextRequest } from "next/server";
import { mercadoPagoConfigured } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/payments/mercadopago";
import { syncMercadoPagoPayment } from "@/lib/payments";

/**
 * Notificaciones de Mercado Pago (Webhooks).
 * Configurar en Mercado Pago > Tus integraciones > Webhooks:
 *   URL: https://<tu-dominio>/api/webhooks/mercadopago   Evento: Pagos
 */
export async function POST(request: NextRequest) {
  if (!mercadoPagoConfigured()) return NextResponse.json({ ok: false }, { status: 503 });

  const url = request.nextUrl;
  let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await request.json();
  } catch {
    // Algunas notificaciones llegan solo con parámetros en la URL
  }

  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (type !== "payment" || !dataId) return NextResponse.json({ ok: true, ignored: true });

  const valid = verifyWebhookSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
  });
  if (!valid) return NextResponse.json({ ok: false, error: "firma inválida" }, { status: 401 });

  try {
    await syncMercadoPagoPayment(dataId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook mercadopago]", (e as Error).message);
    // 500 hace que Mercado Pago reintente más tarde
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
