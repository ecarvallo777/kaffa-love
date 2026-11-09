import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAID_STATUSES } from "@/lib/admin-data";
import { getFairExpenses, getProductCosts, type FairExpense } from "@/lib/costs";
import { computeProfit, makeCostResolver, type ProfitBreakdown, type SaleOrder } from "@/lib/profit";
import { getSettings } from "@/lib/settings";

export type FairProfit = {
  sessionId: string;
  expenses: FairExpense[];
  profit: ProfitBreakdown;
  hours: number | null;
  products: { productId: string; name: string; units: number; revenue: number; cost: number | null }[];
};

/** Utilidad real de una o varias jornadas de feria */
export async function getFairProfits(sessionIds: string[]): Promise<Map<string, FairProfit>> {
  const out = new Map<string, FairProfit>();
  if (!sessionIds.length) return out;
  const db = createAdminClient();
  const [{ data: orders }, { data: sessions }, { data: bundleItems }, costs, expensesBySession, settings] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, number, channel, status, delivery, subtotal_clp, shipping_clp, total_clp, created_at, paid_at, customer_id, fair_session_id, shipping_address, order_items (product_id, product_name, unit_price_clp, quantity, grind)",
      )
      .eq("channel", "feria")
      .in("status", PAID_STATUSES)
      .in("fair_session_id", sessionIds),
    db.from("fair_sessions").select("id, opened_at, closed_at").in("id", sessionIds),
    db.from("bundle_items").select("bundle_id, product_id, quantity"),
    getProductCosts(),
    getFairExpenses(),
    getSettings(),
  ]);
  const costOf = makeCostResolver(costs, bundleItems ?? []);

  for (const id of sessionIds) {
    const mine = ((orders ?? []) as unknown as SaleOrder[]).filter((o) => o.fair_session_id === id);
    const expenses = expensesBySession[id] ?? [];
    const profit = computeProfit({
      orders: mine,
      settings,
      costOf,
      expenses: expenses.reduce((s, e) => s + e.amountClp, 0),
    });

    const byProduct = new Map<string, { productId: string; name: string; units: number; revenue: number; cost: number | null }>();
    for (const o of mine) {
      for (const i of o.order_items) {
        const cur = byProduct.get(i.product_id) ?? { productId: i.product_id, name: i.product_name, units: 0, revenue: 0, cost: 0 as number | null };
        cur.units += i.quantity;
        cur.revenue += i.unit_price_clp * i.quantity;
        const unit = costOf(i.product_id);
        cur.cost = unit === null || cur.cost === null ? null : cur.cost + unit * i.quantity;
        byProduct.set(i.product_id, cur);
      }
    }

    const s = sessions?.find((x) => x.id === id);
    const hours = s?.closed_at ? (Date.parse(s.closed_at) - Date.parse(s.opened_at)) / 3600_000 : null;
    out.set(id, {
      sessionId: id,
      expenses,
      profit,
      hours: hours && hours >= 0.5 ? hours : null, // jornadas muy cortas distorsionan la utilidad por hora
      products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue),
    });
  }
  return out;
}
