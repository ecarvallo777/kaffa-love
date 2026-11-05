import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeAgent, dateRange } from "@/lib/agent-api";
import { PAID_STATUSES } from "@/lib/admin-data";

/**
 * Pedidos online y ventas de feria en un rango de fechas (por fecha de creación).
 * Parámetros: desde, hasta (ISO), canal (online|feria), solo_pagados (true|false), limite.
 * Sin datos personales: el cliente se identifica con un id anónimo y la comuna/región.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeAgent(request);
  if (denied) return denied;

  const { desde, hasta, limite } = dateRange(request);
  const sp = request.nextUrl.searchParams;
  let q = createAdminClient()
    .from("orders")
    .select("id, number, channel, status, delivery, subtotal_clp, shipping_clp, total_clp, created_at, paid_at, customer_id, fair_session_id, shipping_address, order_items (product_id, product_name, unit_price_clp, quantity, grind)")
    .gte("created_at", desde)
    .lte("created_at", hasta)
    .order("created_at", { ascending: false })
    .limit(limite);
  const canal = sp.get("canal");
  if (canal === "online" || canal === "feria") q = q.eq("channel", canal);
  if (sp.get("solo_pagados") !== "false") q = q.in("status", PAID_STATUSES);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    desde,
    hasta,
    ventas: data.map(({ shipping_address, customer_id, ...o }) => {
      const addr = shipping_address as { commune?: string; region?: string } | null;
      return {
        ...o,
        cliente_id: customer_id, // id interno, sin datos de contacto
        comuna: addr?.commune ?? null,
        region: addr?.region ?? null,
      };
    }),
  });
}
