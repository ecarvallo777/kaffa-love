import { NextResponse, type NextRequest } from "next/server";
import { expirePendingOrders } from "@/lib/orders";
import { reconcilePendingPayments } from "@/lib/payments";

/**
 * Tarea periódica (cron-job.org cada 5 minutos y Vercel Cron una vez al día),
 * con la cabecera Authorization: Bearer <CRON_SECRET>.
 *   1. Confirma pedidos con pagos aprobados en Mercado Pago cuyo aviso no llegó.
 *   2. Libera el stock de pedidos sin pagar cuya reserva venció.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const confirmed = await reconcilePendingPayments();
  const expired = await expirePendingOrders();
  return NextResponse.json({ ok: true, confirmed, expired });
}
