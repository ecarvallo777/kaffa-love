import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PAID_STATUSES = ["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"];

export async function salesSince(sinceIso: string) {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select("channel, total_clp")
    .in("status", PAID_STATUSES)
    .gte("paid_at", sinceIso);
  if (error) throw new Error(error.message);
  const by = { online: { count: 0, total: 0 }, feria: { count: 0, total: 0 } };
  for (const o of data) {
    const k = o.channel as "online" | "feria";
    by[k].count++;
    by[k].total += o.total_clp;
  }
  return { ...by, total: by.online.total + by.feria.total, count: by.online.count + by.feria.count };
}

/** Productos con stock bajo (solo los que controlan stock) */
export async function lowStock() {
  const { data, error } = await createAdminClient()
    .from("products")
    .select("id, name, stock, low_stock_threshold, type")
    .eq("active", true)
    .eq("track_stock", true)
    .order("stock");
  if (error) throw new Error(error.message);
  return data.filter((p) => p.stock <= p.low_stock_threshold);
}

export async function listProducts() {
  const { data, error } = await createAdminClient()
    .from("products")
    .select("id, name, slug, type, category_id, price_clp, stock, track_stock, low_stock_threshold, visible_online, active")
    .order("type")
    .order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listCategories() {
  const { data, error } = await createAdminClient()
    .from("categories")
    .select("id, name, slug, parent_id, sort_order, active")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}
