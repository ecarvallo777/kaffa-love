import { NextResponse, type NextRequest } from "next/server";
import { expirePendingOrders } from "@/lib/orders";
import { reconcilePendingPayments } from "@/lib/payments";
import { runAbandonedCartEmails, runRepurchaseEmails, runReviewEmails } from "@/lib/automations";
import { syncDriveInvoices } from "@/lib/purchases";
import { runMigratedWelcomeEmails } from "@/lib/welcome-migrated";
import { runWeeklyMarketing } from "@/lib/marketing/agent";

// Leer una factura nueva con Claude puede tomar alrededor de un minuto
export const maxDuration = 300;

/**
 * Tarea periódica (cron-job.org cada 5 minutos y Vercel Cron una vez al día),
 * con la cabecera Authorization: Bearer <CRON_SECRET>.
 *   1. Confirma pedidos con pagos aprobados en Mercado Pago cuyo aviso no llegó.
 *   2. Libera el stock de pedidos sin pagar cuya reserva venció.
 *   3. Envía los correos automáticos (carrito abandonado, recompra y reseña).
 *   4. Los lunes, prepara el plan de marketing de la semana (src/lib/marketing/agent.ts).
 *   5. Lee la factura de compra más antigua que aún no se haya leído en Google Drive.
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
  const welcomeEmails = await runMigratedWelcomeEmails().catch((e) => (console.error("[cron] bienvenida:", e), 0));
  // Plan de marketing (lunes): tarda 1 a 2 minutos, así que esa pasada no lee facturas
  const marketing = await runWeeklyMarketing().catch((e) => (console.error("[cron] marketing:", e), false));
  const invoices = marketing ? null : await syncDriveInvoices(1).catch((e) => (console.error("[cron] facturas:", e), null));
  return NextResponse.json({ ok: true, confirmed, expired, abandonEmails, repurchaseEmails, reviewEmails, welcomeEmails, marketing, invoices });
}
