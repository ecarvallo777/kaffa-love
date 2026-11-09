import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adjustStock } from "@/lib/stock";

/*
 * Conteo de inventario.
 * El stock del sistema ya descuenta los pedidos pagados que aún no se entregan y las
 * reservas de pago en curso, pero esas unidades siguen físicamente en la bodega.
 * Por eso el conteo se compara contra lo que DEBERÍA haber físicamente:
 *   debería haber = disponible + comprometido (pedidos online por entregar)
 */

/** Estados en que las unidades ya se descontaron pero siguen en la bodega */
const COMMITTED_STATUSES = ["pendiente_pago", "pagado", "en_preparacion", "listo_retiro"];

export type InventoryRow = {
  id: string;
  name: string;
  type: string;
  categoryId: string | null;
  available: number;
  committed: number;
  expected: number;
};

export async function getInventorySheet(): Promise<InventoryRow[]> {
  const db = createAdminClient();
  const [{ data: products, error }, { data: openOrders }] = await Promise.all([
    db
      .from("products")
      .select("id, name, type, category_id, stock")
      .eq("active", true)
      .eq("track_stock", true)
      .neq("type", "promocion")
      .order("type")
      .order("name"),
    db.from("orders").select("id").eq("channel", "online").in("status", COMMITTED_STATUSES),
  ]);
  if (error) throw new Error(error.message);

  // Unidades comprometidas por producto (las promociones se expanden a sus productos)
  const committed = new Map<string, number>();
  const needs = await Promise.all(
    (openOrders ?? []).map((o) => db.rpc("order_stock_needs", { p_order_id: o.id }).then((r) => r.data ?? [])),
  );
  for (const list of needs) {
    for (const n of list as { product_id: string; qty: number }[]) {
      committed.set(n.product_id, (committed.get(n.product_id) ?? 0) + n.qty);
    }
  }

  return (products ?? []).map((p) => {
    const c = committed.get(p.id) ?? 0;
    return { id: p.id, name: p.name, type: p.type, categoryId: p.category_id, available: p.stock, committed: c, expected: p.stock + c };
  });
}

export type CountResult = { name: string; expected: number; counted: number; delta: number; error?: string };

/**
 * Aplica un conteo: por cada producto contado, registra la diferencia contra lo que
 * debería haber (recalculado al momento de aplicar, por si hubo ventas mientras se contaba).
 */
export async function applyInventoryCount(opts: {
  counts: { productId: string; counted: number }[];
  reason: "ajuste" | "compra";
  note: string;
  userId: string;
}) {
  const sheet = await getInventorySheet();
  const results: CountResult[] = [];
  const label = opts.reason === "compra" ? "Mercadería recibida" : "Conteo de inventario";

  for (const c of opts.counts) {
    const row = sheet.find((r) => r.id === c.productId);
    if (!row || !Number.isInteger(c.counted) || c.counted < 0) continue;
    const delta = c.counted - row.expected;
    if (delta === 0) {
      results.push({ name: row.name, expected: row.expected, counted: c.counted, delta: 0 });
      continue;
    }
    // El disponible no puede quedar negativo: si hay menos unidades que pedidos por entregar, se avisa
    if (row.available + delta < 0) {
      results.push({
        name: row.name,
        expected: row.expected,
        counted: c.counted,
        delta,
        error: `Contaste ${c.counted}, pero hay ${row.committed} comprometidas en pedidos por entregar. Revisa esos pedidos antes de ajustar.`,
      });
      continue;
    }
    try {
      await adjustStock({
        productId: row.id,
        delta,
        reason: opts.reason,
        note: `${label}: contado ${c.counted}, esperado ${row.expected}${opts.note ? ` · ${opts.note}` : ""}`,
        userId: opts.userId,
      });
      results.push({ name: row.name, expected: row.expected, counted: c.counted, delta });
    } catch (e) {
      results.push({ name: row.name, expected: row.expected, counted: c.counted, delta, error: (e as Error).message });
    }
  }
  return results;
}
