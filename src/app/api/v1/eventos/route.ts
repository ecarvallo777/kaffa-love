import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeAgent, dateRange, scrubEventData } from "@/lib/agent-api";

/**
 * Historial de eventos del negocio (pedido_creado, pago_confirmado, pedido_expirado
 * —equivale a un checkout abandonado—, venta_feria, stock_ajustado, estado_cambiado…).
 * Parámetros: desde, hasta (ISO), tipo, limite.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeAgent(request);
  if (denied) return denied;

  const { desde, hasta, limite } = dateRange(request, 7);
  const tipo = request.nextUrl.searchParams.get("tipo");
  let q = createAdminClient()
    .from("events")
    .select("id, type, entity, entity_id, data, created_at")
    .gte("created_at", desde)
    .lte("created_at", hasta)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (tipo) q = q.eq("type", tipo);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    desde,
    hasta,
    eventos: data.map((e) => ({ ...e, data: scrubEventData(e.data as Record<string, unknown>) })),
  });
}
