import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAID_STATUSES } from "@/lib/admin-data";
import { getFairExpenses, getProductCosts, type FairExpense } from "@/lib/costs";
import { computeProfit, makeCostResolver, type ProfitBreakdown, type SaleOrder } from "@/lib/profit";
import { getSettings } from "@/lib/settings";
import { getMpFairExpensesBySession } from "@/lib/fair-mp-expenses";

export type FairProfit = {
  sessionId: string;
  /** Gastos anotados a mano (stand y otros) */
  expenses: FairExpense[];
  /** Gastos tomados solos de Mercado Pago (los clasificados como gasto de la feria) */
  mpExpenses: FairExpense[];
  profit: ProfitBreakdown;
  /** Horas de venta: en cada día, de la primera a la última venta (mín. 1 h por día). Una jornada puede durar varios días. */
  hours: number | null;
  products: { productId: string; name: string; units: number; revenue: number; cost: number | null }[];
  /** Ventas por día (hora de Chile): qué se vendió cada día de la jornada */
  days: { date: string; gross: number; sales: number; byProduct: Record<string, { units: number; revenue: number }> }[];
};

const chileDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });

/** Utilidad real de una o varias jornadas de feria */
export async function getFairProfits(sessionIds: string[]): Promise<Map<string, FairProfit>> {
  const out = new Map<string, FairProfit>();
  if (!sessionIds.length) return out;
  const db = createAdminClient();
  const [{ data: orders }, { data: bundleItems }, costs, expensesBySession, settings] = await Promise.all([
    db
      .from("orders")
      .select(
        "id, number, channel, status, delivery, subtotal_clp, shipping_clp, total_clp, created_at, paid_at, customer_id, fair_session_id, shipping_address, order_items (product_id, product_name, unit_price_clp, quantity, grind)",
      )
      .eq("channel", "feria")
      .in("status", PAID_STATUSES)
      .in("fair_session_id", sessionIds),
    db.from("bundle_items").select("bundle_id, product_id, quantity"),
    getProductCosts(),
    getFairExpenses(),
    getSettings(),
  ]);
  const mpBySession = await getMpFairExpensesBySession().catch((e) => (console.error("[ferias] gastos de Mercado Pago:", e), {} as Record<string, FairExpense[]>));
  // El stand tiene factura: su IVA se recupera, así que resta el neto. El resto no tiene factura: resta completo.
  const expenseCost = (e: FairExpense) => (e.category === "Stand" ? (e.amountClp * 100) / (100 + settings.ivaPct) : e.amountClp);
  const costOf = makeCostResolver(costs, bundleItems ?? []);

  for (const id of sessionIds) {
    const mine = ((orders ?? []) as unknown as SaleOrder[]).filter((o) => o.fair_session_id === id);
    const expenses = expensesBySession[id] ?? [];
    const mpExpenses = mpBySession[id] ?? [];
    const profit = computeProfit({
      orders: mine,
      settings,
      costOf,
      expenses: [...expenses, ...mpExpenses].reduce((s, e) => s + expenseCost(e), 0),
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

    const days = new Map<string, FairProfit["days"][number]>();
    const span = new Map<string, { first: number; last: number }>();
    for (const o of mine) {
      const at = new Date(o.paid_at ?? o.created_at);
      const date = chileDay.format(at);
      const sp = span.get(date) ?? { first: at.getTime(), last: at.getTime() };
      span.set(date, { first: Math.min(sp.first, at.getTime()), last: Math.max(sp.last, at.getTime()) });
      const d = days.get(date) ?? { date, gross: 0, sales: 0, byProduct: {} };
      d.sales += 1;
      for (const i of o.order_items) {
        const cur = (d.byProduct[i.product_id] ??= { units: 0, revenue: 0 });
        cur.units += i.quantity;
        cur.revenue += i.unit_price_clp * i.quantity;
        d.gross += i.unit_price_clp * i.quantity;
      }
      days.set(date, d);
    }

    // La jornada puede durar de viernes a domingo: se cuentan solo las horas en que se vendió
    const hours = [...span.values()].reduce((h, d) => h + Math.max(1, (d.last - d.first) / 3600_000), 0) || null;
    out.set(id, {
      sessionId: id,
      expenses,
      mpExpenses,
      profit,
      hours,
      products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue),
      days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    });
  }
  return out;
}
