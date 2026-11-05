import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type Reason = "compra" | "ajuste" | "inicio_jornada";

/**
 * Suma o resta stock dejando registro del motivo. Usa control optimista:
 * si otra venta cambió el stock al mismo tiempo, vuelve a intentar.
 * Nunca deja el stock negativo.
 */
export async function adjustStock(opts: { productId: string; delta: number; reason: Reason; note?: string | null; userId?: string | null }) {
  const db = createAdminClient();
  if (!Number.isInteger(opts.delta) || opts.delta === 0) throw new Error("La cantidad debe ser un número entero distinto de cero.");

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: p, error } = await db.from("products").select("stock, track_stock, name").eq("id", opts.productId).single();
    if (error) throw new Error(error.message);
    if (!p.track_stock) throw new Error(`${p.name} no controla stock.`);
    const next = p.stock + opts.delta;
    if (next < 0) throw new Error(`${p.name} quedaría con stock negativo (hay ${p.stock}).`);

    const { data: updated, error: upErr } = await db
      .from("products")
      .update({ stock: next, updated_at: new Date().toISOString() })
      .eq("id", opts.productId)
      .eq("stock", p.stock)
      .select("id");
    if (upErr) throw new Error(upErr.message);
    if (updated?.length) {
      await db.from("stock_movements").insert({
        product_id: opts.productId,
        delta: opts.delta,
        reason: opts.reason,
        note: opts.note ?? null,
        created_by: opts.userId ?? null,
      });
      return { name: p.name as string, before: p.stock as number, after: next };
    }
  }
  throw new Error("El stock cambió varias veces mientras guardabas. Intenta de nuevo.");
}
