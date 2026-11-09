import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAID_STATUSES } from "@/lib/admin-data";
import type { Settings } from "@/lib/settings";
import type { Grind } from "@/lib/catalog-types";

/*
 * Utilidad real de ventas (feria y tienda):
 *   ventas brutas (con IVA, solo productos)
 *   − IVA (ventas × iva / (100 + iva))
 *   = ventas netas
 *   − costo neto de los productos vendidos (promociones: suma de sus productos)
 *   − comisión de Mercado Pago (% sobre lo cobrado, distinto en feria y tienda)
 *   − gastos (los de cada jornada de feria)
 *   = utilidad
 * El despacho cobrado se considera traspaso a Blue Express (no suma ni resta).
 */

export type SaleItem = { product_id: string; product_name: string; unit_price_clp: number; quantity: number; grind: Grind | null };

export type SaleOrder = {
  id: string;
  number: number;
  channel: "online" | "feria";
  status: string;
  delivery: string;
  subtotal_clp: number;
  shipping_clp: number;
  total_clp: number;
  created_at: string;
  paid_at: string | null;
  customer_id: string | null;
  fair_session_id: string | null;
  shipping_address: { commune?: string; region?: string } | null;
  order_items: SaleItem[];
};

/** Pedidos pagados (online y feria) creados en un rango */
export async function getPaidOrders(fromIso: string, toIso: string): Promise<SaleOrder[]> {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select(
      "id, number, channel, status, delivery, subtotal_clp, shipping_clp, total_clp, created_at, paid_at, customer_id, fair_session_id, shipping_address, order_items (product_id, product_name, unit_price_clp, quantity, grind)",
    )
    .in("status", PAID_STATUSES)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at")
    .limit(5000);
  if (error) throw new Error(error.message);
  return data as unknown as SaleOrder[];
}

/** Costo neto unitario de un producto; las promociones suman el costo de sus productos */
export function makeCostResolver(costs: Record<string, number>, bundleItems: { bundle_id: string; product_id: string; quantity: number }[]) {
  return (productId: string): number | null => {
    const comps = bundleItems.filter((b) => b.bundle_id === productId);
    if (comps.length) {
      let sum = 0;
      for (const c of comps) {
        const unit = costs[c.product_id];
        if (unit === undefined) return null;
        sum += unit * c.quantity;
      }
      return sum;
    }
    return costs[productId] ?? null;
  };
}

export type ProfitBreakdown = {
  gross: number;
  iva: number;
  net: number;
  productCost: number;
  commission: number;
  expenses: number;
  profit: number;
  /** Utilidad sobre ventas netas */
  margin: number | null;
  units: number;
  orders: number;
  /** Productos vendidos sin costo ingresado (su costo se cuenta como 0) */
  missingCost: string[];
};

export function computeProfit(opts: {
  orders: SaleOrder[];
  settings: Pick<Settings, "ivaPct" | "mpFeriaPct" | "mpTiendaPct">;
  costOf: (productId: string) => number | null;
  expenses?: number;
}): ProfitBreakdown {
  const { orders, settings, costOf } = opts;
  let gross = 0;
  let productCost = 0;
  let commission = 0;
  let units = 0;
  const missing = new Set<string>();

  for (const o of orders) {
    const products = o.order_items.reduce((s, i) => s + i.unit_price_clp * i.quantity, 0);
    gross += products;
    const pct = o.channel === "feria" ? settings.mpFeriaPct : settings.mpTiendaPct;
    commission += (o.total_clp * pct) / 100;
    for (const i of o.order_items) {
      units += i.quantity;
      const c = costOf(i.product_id);
      if (c === null) missing.add(i.product_name);
      else productCost += c * i.quantity;
    }
  }

  const iva = (gross * settings.ivaPct) / (100 + settings.ivaPct);
  const net = gross - iva;
  const expenses = opts.expenses ?? 0;
  const profit = net - productCost - commission - expenses;
  return {
    gross: Math.round(gross),
    iva: Math.round(iva),
    net: Math.round(net),
    productCost: Math.round(productCost),
    commission: Math.round(commission),
    expenses: Math.round(expenses),
    profit: Math.round(profit),
    margin: net > 0 ? profit / net : null,
    units,
    orders: orders.length,
    missingCost: [...missing].sort(),
  };
}
