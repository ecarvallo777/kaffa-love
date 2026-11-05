import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent, logEventLater } from "@/lib/events";
import { refreshCatalog } from "@/lib/catalog-revalidate";
import { adjustStock } from "@/lib/stock";
import { expirePendingOrders, priceLines, reserveOrDelete, type LineInput } from "@/lib/orders";
import { PAID_STATUSES } from "@/lib/admin-data";

export type FairSession = {
  id: string;
  name: string;
  location: string | null;
  opened_at: string;
  closed_at: string | null;
  point_total_clp: number | null;
  notes: string | null;
};

export async function getOpenSession(): Promise<FairSession | null> {
  const { data } = await createAdminClient()
    .from("fair_sessions")
    .select("*")
    .is("closed_at", null)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Productos que se pueden vender en la feria (incluye preparados) */
export async function fairProducts() {
  const db = createAdminClient();
  const [{ data: products }, { data: bundleItems }] = await Promise.all([
    db
      .from("products")
      .select("id, name, slug, type, category_id, description, origin, process, variety, tasting_notes, price_clp, track_stock, stock, low_stock_threshold, image_urls")
      .eq("active", true)
      .order("type")
      .order("name"),
    db.from("bundle_items").select("bundle_id, product_id, quantity"),
  ]);
  return { products: products ?? [], bundleItems: bundleItems ?? [] };
}

export async function openSession(input: {
  name: string;
  location: string;
  preparados: { productId: string; qty: number }[];
  userId: string;
  email: string;
}) {
  const db = createAdminClient();
  if (await getOpenSession()) throw new Error("Ya hay una jornada abierta. Ciérrala antes de abrir otra.");
  const { data: session, error } = await db
    .from("fair_sessions")
    .insert({ name: input.name, location: input.location || null, opened_by: input.userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  // Preparados contables (tortas, etc.): se deja el stock en la cantidad del día
  for (const p of input.preparados) {
    const { data: current } = await db.from("products").select("stock, type, track_stock").eq("id", p.productId).single();
    if (!current || current.type !== "preparado" || !current.track_stock) continue;
    const delta = p.qty - current.stock;
    if (delta !== 0) {
      await adjustStock({ productId: p.productId, delta, reason: "inicio_jornada", note: `Jornada ${input.name}`, userId: input.userId });
    }
  }
  refreshCatalog();
  await logEvent("jornada_abierta", "fair_session", session.id, { nombre: input.name, lugar: input.location, por: input.email });
  return session as FairSession;
}

export type FairSaleResult = { ok: true; number: number; total: number } | { ok: false, error: string };

export async function registerFairSale(sessionId: string, lines: LineInput[], email: string): Promise<FairSaleResult> {
  const session = await getOpenSession();
  if (!session || session.id !== sessionId) return { ok: false, error: "La jornada ya no está abierta." };

  let priced = await priceLines(lines, "feria");
  if (priced.problems.length && (await expirePendingOrders()) > 0) priced = await priceLines(lines, "feria");
  if (priced.problems.length) return { ok: false, error: priced.problems.join(" ") };

  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .insert({
      channel: "feria",
      status: "pagado",
      delivery: "presencial",
      fair_session_id: sessionId,
      subtotal_clp: priced.subtotal,
      shipping_clp: 0,
      total_clp: priced.subtotal,
      paid_at: new Date().toISOString(),
    })
    .select("id, number, total_clp")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: itemsError } = await db.from("order_items").insert(
    priced.lines.map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      product_name: l.product.name,
      unit_price_clp: l.unitPriceClp,
      quantity: l.qty,
      grind: l.grind,
    })),
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    return { ok: false, error: itemsError.message };
  }

  const stockError = await reserveOrDelete(order.id);
  if (stockError) return { ok: false, error: `${stockError} No cobres esta venta.` };

  refreshCatalog();
  logEventLater("venta_feria", "order", order.id, {
    jornada: sessionId,
    total_clp: order.total_clp,
    por: email,
    items: priced.lines.map((l) => ({ product_id: l.product.id, qty: l.qty, grind: l.grind })),
  });
  return { ok: true, number: order.number, total: order.total_clp };
}

/** Anula una venta de la jornada abierta y devuelve su stock */
export async function voidFairSale(orderId: string, email: string) {
  const db = createAdminClient();
  const session = await getOpenSession();
  const { data: order } = await db.from("orders").select("id, fair_session_id, status").eq("id", orderId).maybeSingle();
  if (!order || !session || order.fair_session_id !== session.id) throw new Error("Solo se pueden anular ventas de la jornada abierta.");
  if (order.status === "cancelado") return;
  const { error } = await db.rpc("release_order_stock", { p_order_id: orderId });
  if (error) throw new Error(error.message);
  await db.from("orders").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", orderId);
  refreshCatalog();
  await logEvent("pedido_cancelado", "order", orderId, { canal: "feria", por: email });
}

export async function sessionSummary(sessionId: string) {
  const { data: orders, error } = await createAdminClient()
    .from("orders")
    .select("id, number, status, total_clp, created_at, order_items (product_name, quantity, unit_price_clp, grind)")
    .eq("fair_session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const paid = orders.filter((o) => PAID_STATUSES.includes(o.status));
  const byProduct = new Map<string, { qty: number; total: number }>();
  for (const o of paid) {
    for (const i of o.order_items as { product_name: string; quantity: number; unit_price_clp: number }[]) {
      const cur = byProduct.get(i.product_name) ?? { qty: 0, total: 0 };
      cur.qty += i.quantity;
      cur.total += i.quantity * i.unit_price_clp;
      byProduct.set(i.product_name, cur);
    }
  }
  return {
    orders,
    count: paid.length,
    total: paid.reduce((s, o) => s + o.total_clp, 0),
    products: [...byProduct.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
  };
}

export async function closeSession(sessionId: string, pointTotal: number | null, notes: string, email: string) {
  const summary = await sessionSummary(sessionId);
  const { error } = await createAdminClient()
    .from("fair_sessions")
    .update({ closed_at: new Date().toISOString(), point_total_clp: pointTotal, notes: notes || null })
    .eq("id", sessionId)
    .is("closed_at", null);
  if (error) throw new Error(error.message);
  await logEvent("jornada_cerrada", "fair_session", sessionId, {
    ventas: summary.count,
    total_app: summary.total,
    total_point: pointTotal,
    diferencia: pointTotal !== null ? pointTotal - summary.total : null,
    por: email,
  });
  return summary;
}
