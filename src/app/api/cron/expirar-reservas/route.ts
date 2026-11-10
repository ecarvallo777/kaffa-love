import { NextResponse, type NextRequest } from "next/server";
import { expirePendingOrders } from "@/lib/orders";
import { reconcilePendingPayments } from "@/lib/payments";
import { runAbandonedCartEmails, runRepurchaseEmails, runReviewEmails } from "@/lib/automations";

/**
 * Tarea periódica (cron-job.org cada 5 minutos y Vercel Cron una vez al día),
 * con la cabecera Authorization: Bearer <CRON_SECRET>.
 *   1. Confirma pedidos con pagos aprobados en Mercado Pago cuyo aviso no llegó.
 *   2. Libera el stock de pedidos sin pagar cuya reserva venció.
 *   3. Envía los correos automáticos (carrito abandonado, recompra y reseña).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const confirmed = await reconcilePendingPayments();
  const expired = await expirePendingOrders();
  // Los correos no deben impedir que la tarea responda: un error se informa y sigue
  const abandonEmails = await runAbandonedCartEmails().catch((e) => (console.error("[cron] abandono:", e), 0));
  const repurchaseEmails = await runRepurchaseEmails().catch((e) => (console.error("[cron] recompra:", e), 0));
  const reviewEmails = await runReviewEmails().catch((e) => (console.error("[cron] reseñas:", e), 0));
  return NextResponse.json({ ok: true, confirmed, expired, abandonEmails, repurchaseEmails, reviewEmails });
}
