import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeAgent } from "@/lib/agent-api";
import { PAID_STATUSES } from "@/lib/admin-data";

/**
 * Resumen anónimo de clientes para detectar recompras (PRD §10, etapa 4).
 * Solo id interno, consentimiento de novedades y su historial de compras.
 * Para contactar a alguien, una persona del equipo lo busca en la administración.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeAgent(request);
  if (denied) return denied;

  const db = createAdminClient();
  const [{ data: customers, error }, { data: orders }] = await Promise.all([
    db.from("customers").select("id, marketing_consent, source, created_at"),
    db.from("orders").select("customer_id, total_clp, paid_at, order_items (product_id, quantity)").eq("channel", "online").in("status", PAID_STATUSES),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    clientes: customers.map((c) => {
      const mine = (orders ?? []).filter((o) => o.customer_id === c.id);
      const dates = mine.map((o) => o.paid_at).filter(Boolean).sort();
      return {
        id: c.id,
        acepta_novedades: c.marketing_consent,
        origen: c.source,
        desde: c.created_at,
        compras: mine.length,
        total_clp: mine.reduce((s, o) => s + o.total_clp, 0),
        primera_compra: dates[0] ?? null,
        ultima_compra: dates.at(-1) ?? null,
        productos: mine.flatMap((o) => o.order_items as { product_id: string; quantity: number }[]),
      };
    }),
  });
}
