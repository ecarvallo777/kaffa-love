import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeAgent } from "@/lib/agent-api";

/** Catálogo completo con stock (incluye productos solo de feria e inactivos) */
export async function GET(request: NextRequest) {
  const denied = authorizeAgent(request);
  if (denied) return denied;

  const db = createAdminClient();
  const [{ data: products, error }, { data: bundles }, { data: categories }] = await Promise.all([
    db
      .from("products")
      .select("id, sku, name, slug, type, category_id, origin, process, variety, tasting_notes, price_clp, track_stock, stock, low_stock_threshold, visible_online, active, updated_at")
      .order("name"),
    db.from("bundle_items").select("bundle_id, product_id, quantity"),
    db.from("categories").select("id, name, slug, parent_id"),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    productos: products.map((p) => ({
      ...p,
      stock_bajo: p.track_stock && p.stock <= p.low_stock_threshold,
      incluye: p.type === "promocion" ? bundles?.filter((b) => b.bundle_id === p.id).map(({ product_id, quantity }) => ({ product_id, quantity })) : undefined,
    })),
    categorias: categories,
  });
}
