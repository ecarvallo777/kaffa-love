import { NextResponse, type NextRequest } from "next/server";
import { expirePendingOrders } from "@/lib/orders";

/**
 * Libera el stock de pedidos sin pagar cuya reserva venció.
 * Lo llama Vercel Cron (ver vercel.json) con la cabecera
 * Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const expired = await expirePendingOrders();
  return NextResponse.json({ ok: true, expired });
}
