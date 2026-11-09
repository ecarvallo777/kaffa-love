import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductCosts } from "@/lib/costs";
import { getSettings } from "@/lib/settings";
import { computeProfit, getPaidOrders, makeCostResolver, type ProfitBreakdown, type SaleOrder } from "@/lib/profit";
import { getFairProfits } from "@/lib/fair-profit";
import type { Grind } from "@/lib/catalog-types";

/*
 * Datos del dashboard de ventas (tienda online y feria) para un período,
 * comparados con el período anterior de igual duración.
 */

const TZ = "America/Santiago";
export type Channel = "todos" | "online" | "feria";
export const PERIODS = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 } as const;
export type PeriodKey = keyof typeof PERIODS;

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const hourOf = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(d));
const weekdayOf = (d: Date) => new Intl.DateTimeFormat("es-CL", { timeZone: TZ, weekday: "short" }).format(d);

export type Bucket = { key: string; label: string; online: number; feria: number };

export type Report = {
  from: string;
  to: string;
  channel: Channel;
  current: ProfitBreakdown;
  previous: ProfitBreakdown;
  avgTicket: number;
  prevAvgTicket: number;
  series: Bucket[];
  bucketUnit: "día" | "semana" | "mes";
  products: { productId: string; name: string; units: number; revenue: number; profit: number | null; margin: number | null }[];
  grinds: { grind: Grind; units: number }[];
  funnel: { created: number; wentToPay: number; paid: number; abandoned: number };
  /** Visitantes únicos (anónimos) en cada paso, desde el registro de la tienda */
  visitors: { viewed: number; added: number; checkout: number };
  /** Correos automáticos: enviados, clics en el enlace y compras posteriores (hasta 7 días después) */
  automations: { kind: "abandono" | "recompra"; sent: number; clicks: number; purchases: number; revenue: number }[];
  customers: { buyers: number; newBuyers: number; returning: number; repeatRate: number | null };
  communes: { name: string; orders: number; revenue: number }[];
  delivery: { retiro: number; despacho: number };
  fairHours: { hour: number; revenue: number; sales: number }[];
  weekdays: { day: string; online: number; feria: number }[];
  fairs: { id: string; name: string; date: string; gross: number; profit: number; margin: number | null; perHour: number | null; avgTicket: number; sales: number; hasExpenses: boolean; missingCosts: boolean }[];
  missingCost: string[];
  commissionsMissing: boolean;
};

function bucketFor(d: Date, unit: Report["bucketUnit"]): { key: string; label: string } {
  const k = dayKey(d); // YYYY-MM-DD
  if (unit === "día") {
    return { key: k, label: new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "numeric", month: "short" }).format(d) };
  }
  if (unit === "mes") {
    return { key: k.slice(0, 7), label: new Intl.DateTimeFormat("es-CL", { timeZone: TZ, month: "short", year: "2-digit" }).format(d) };
  }
  // Semana: lunes de esa semana
  const local = new Date(`${k}T12:00:00Z`);
  const dow = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - dow);
  const key = local.toISOString().slice(0, 10);
  return { key, label: `sem. ${new Intl.DateTimeFormat("es-CL", { timeZone: "UTC", day: "numeric", month: "short" }).format(local)}` };
}

type EventRow = { type: string; entity_id: string | null; created_at: string; data: Record<string, unknown> | null };

/** Eventos del período por tipo, paginando (pueden ser miles de vistas) */
async function getEvents(types: string[], fromIso: string, toIso: string) {
  const db = createAdminClient();
  const out: EventRow[] = [];
  for (let page = 0; page < 30; page++) {
    const { data, error } = await db
      .from("events")
      .select("type, entity_id, created_at, data")
      .in("type", types)
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at")
      .range(page * 1000, page * 1000 + 999);
    if (error || !data?.length) break;
    out.push(...(data as EventRow[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function getReport(period: PeriodKey, channel: Channel): Promise<Report> {
  const days = PERIODS[period];
  const now = new Date();
  const from = new Date(now.getTime() - days * 86400_000);
  const prevFrom = new Date(from.getTime() - days * 86400_000);
  const db = createAdminClient();

  const [all, prevAll, costs, settings, { data: bundleItems }, { data: createdOrders }, { data: payStarts }, events] = await Promise.all([
    getPaidOrders(from.toISOString(), now.toISOString()),
    getPaidOrders(prevFrom.toISOString(), from.toISOString()),
    getProductCosts(),
    getSettings(),
    db.from("bundle_items").select("bundle_id, product_id, quantity"),
    db.from("orders").select("id, status").eq("channel", "online").gte("created_at", from.toISOString()).lte("created_at", now.toISOString()),
    db.from("events").select("entity_id").eq("type", "pago_iniciado").gte("created_at", from.toISOString()),
    getEvents(
      ["vista_producto", "agrego_carrito", "inicio_checkout", "recupero_carrito", "correo_abandono", "correo_recompra"],
      from.toISOString(),
      now.toISOString(),
    ),
  ]);
  const costOf = makeCostResolver(costs, bundleItems ?? []);
  const pick = (os: SaleOrder[]) => (channel === "todos" ? os : os.filter((o) => o.channel === channel));
  const orders = pick(all);
  const prevOrders = pick(prevAll);

  // Gastos de ferias del período (para la utilidad total)
  const fairIds = [...new Set(orders.filter((o) => o.fair_session_id).map((o) => o.fair_session_id!))];
  const prevFairIds = [...new Set(prevOrders.filter((o) => o.fair_session_id).map((o) => o.fair_session_id!))];
  const fairProfits = await getFairProfits([...new Set([...fairIds, ...prevFairIds])]);
  const expensesOf = (ids: string[]) => ids.reduce((s, id) => s + (fairProfits.get(id)?.profit.expenses ?? 0), 0);

  const current = computeProfit({ orders, settings, costOf, expenses: expensesOf(fairIds) });
  const previous = computeProfit({ orders: prevOrders, settings, costOf, expenses: expensesOf(prevFairIds) });

  // Serie en el tiempo
  const bucketUnit: Report["bucketUnit"] = days <= 31 ? "día" : days <= 120 ? "semana" : "mes";
  const series = new Map<string, Bucket>();
  for (let t = from.getTime(); t <= now.getTime(); t += 86400_000) {
    const b = bucketFor(new Date(t), bucketUnit);
    if (!series.has(b.key)) series.set(b.key, { ...b, online: 0, feria: 0 });
  }
  for (const o of orders) {
    const b = bucketFor(new Date(o.paid_at ?? o.created_at), bucketUnit);
    const cur = series.get(b.key) ?? { ...b, online: 0, feria: 0 };
    cur[o.channel] += o.order_items.reduce((s, i) => s + i.unit_price_clp * i.quantity, 0);
    series.set(b.key, cur);
  }

  // Productos
  const iva = 1 + settings.ivaPct / 100;
  const byProduct = new Map<string, { productId: string; name: string; units: number; revenue: number; cost: number | null }>();
  const grindUnits = new Map<Grind, number>();
  for (const o of orders) {
    for (const i of o.order_items) {
      const cur = byProduct.get(i.product_id) ?? { productId: i.product_id, name: i.product_name, units: 0, revenue: 0, cost: 0 as number | null };
      cur.units += i.quantity;
      cur.revenue += i.unit_price_clp * i.quantity;
      const unit = costOf(i.product_id);
      cur.cost = unit === null || cur.cost === null ? null : cur.cost + unit * i.quantity;
      byProduct.set(i.product_id, cur);
      if (i.grind) grindUnits.set(i.grind, (grindUnits.get(i.grind) ?? 0) + i.quantity);
    }
  }
  const products = [...byProduct.values()]
    .map((p) => {
      const net = p.revenue / iva;
      const profit = p.cost === null ? null : Math.round(net - p.cost);
      return { productId: p.productId, name: p.name, units: p.units, revenue: p.revenue, profit, margin: profit === null || net <= 0 ? null : profit / net };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Embudo de la tienda online
  const started = new Set((payStarts ?? []).map((e) => e.entity_id));
  const created = createdOrders ?? [];
  const funnel = {
    created: created.length,
    wentToPay: created.filter((o) => started.has(o.id)).length,
    paid: created.filter((o) => ["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"].includes(o.status)).length,
    abandoned: created.filter((o) => o.status === "expirado").length,
  };

  // Visitantes únicos por paso
  const uniq = (type: string) => new Set(events.filter((e) => e.type === type).map((e) => e.data?.aid)).size;
  const visitors = { viewed: uniq("vista_producto"), added: uniq("agrego_carrito"), checkout: uniq("inicio_checkout") };

  // Correos automáticos y lo que generaron
  const onlinePaid = all.filter((o) => o.channel === "online" && o.customer_id);
  const automations = (["abandono", "recompra"] as const).map((kind) => {
    const mails = events.filter((e) => e.type === `correo_${kind}`);
    let purchases = 0;
    let revenue = 0;
    for (const m of mails) {
      const t = new Date(m.created_at).getTime();
      const order = onlinePaid.find((o) => {
        const ot = new Date(o.created_at).getTime();
        return o.customer_id === m.data?.customer_id && ot > t && ot - t <= 7 * 86400_000;
      });
      if (order) {
        purchases++;
        revenue += order.order_items.reduce((s, i) => s + i.unit_price_clp * i.quantity, 0);
      }
    }
    return {
      kind,
      sent: mails.length,
      clicks: events.filter((e) => e.type === "recupero_carrito" && e.data?.origen === kind).length,
      purchases,
      revenue,
    };
  });

  // Clientes (tienda online): nuevos = su primera compra pagada cae en el período
  const onlineOrders = all.filter((o) => o.channel === "online" && o.customer_id);
  const buyerIds = [...new Set(onlineOrders.map((o) => o.customer_id!))];
  let newBuyers = 0;
  if (buyerIds.length) {
    const { data: earlier } = await db
      .from("orders")
      .select("customer_id")
      .eq("channel", "online")
      .in("status", ["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"])
      .lt("created_at", from.toISOString())
      .in("customer_id", buyerIds);
    const before = new Set((earlier ?? []).map((o) => o.customer_id));
    newBuyers = buyerIds.filter((id) => !before.has(id)).length;
  }
  const perBuyer = new Map<string, number>();
  for (const o of onlineOrders) perBuyer.set(o.customer_id!, (perBuyer.get(o.customer_id!) ?? 0) + 1);
  const repeaters = [...perBuyer.values()].filter((n) => n > 1).length;

  // Comunas y forma de entrega (online)
  const communes = new Map<string, { name: string; orders: number; revenue: number }>();
  const delivery = { retiro: 0, despacho: 0 };
  for (const o of all.filter((x) => x.channel === "online")) {
    if (o.delivery === "retiro") delivery.retiro++;
    else delivery.despacho++;
    const name = o.delivery === "retiro" ? "Retiro en tienda" : o.shipping_address?.commune?.trim() || "Sin comuna";
    const cur = communes.get(name) ?? { name, orders: 0, revenue: 0 };
    cur.orders++;
    cur.revenue += o.subtotal_clp;
    communes.set(name, cur);
  }

  // Horas de venta en feria y días de la semana
  const fairHours = new Map<number, { hour: number; revenue: number; sales: number }>();
  const weekdaysOrder = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  const weekdays = new Map(weekdaysOrder.map((d) => [d, { day: d, online: 0, feria: 0 }]));
  for (const o of orders) {
    const d = new Date(o.paid_at ?? o.created_at);
    const amount = o.order_items.reduce((s, i) => s + i.unit_price_clp * i.quantity, 0);
    const wd = weekdayOf(d).replace(".", "").toLowerCase();
    const w = weekdays.get(wd);
    if (w) w[o.channel] += amount;
    if (o.channel === "feria") {
      const h = hourOf(d);
      const cur = fairHours.get(h) ?? { hour: h, revenue: 0, sales: 0 };
      cur.revenue += amount;
      cur.sales++;
      fairHours.set(h, cur);
    }
  }

  // Ranking de ferias del período
  const { data: sessions } = fairIds.length
    ? await db.from("fair_sessions").select("id, name, opened_at").in("id", fairIds)
    : { data: [] as { id: string; name: string; opened_at: string }[] };
  const fairs = (sessions ?? [])
    .map((s) => {
      const fp = fairProfits.get(s.id)!;
      return {
        id: s.id,
        name: s.name,
        date: s.opened_at,
        gross: fp.profit.gross,
        profit: fp.profit.profit,
        margin: fp.profit.margin,
        perHour: fp.hours ? Math.round(fp.profit.profit / fp.hours) : null,
        avgTicket: fp.profit.orders ? Math.round(fp.profit.gross / fp.profit.orders) : 0,
        sales: fp.profit.orders,
        hasExpenses: fp.expenses.length > 0,
        missingCosts: fp.profit.missingCost.length > 0,
      };
    })
    .sort((a, b) => b.profit - a.profit);

  return {
    from: from.toISOString(),
    to: now.toISOString(),
    channel,
    current,
    previous,
    avgTicket: current.orders ? Math.round(current.gross / current.orders) : 0,
    prevAvgTicket: previous.orders ? Math.round(previous.gross / previous.orders) : 0,
    series: [...series.values()].sort((a, b) => a.key.localeCompare(b.key)),
    bucketUnit,
    products,
    grinds: (["grano", "fina", "media", "gruesa"] as Grind[]).map((g) => ({ grind: g, units: grindUnits.get(g) ?? 0 })),
    funnel,
    visitors,
    automations,
    customers: { buyers: buyerIds.length, newBuyers, returning: buyerIds.length - newBuyers, repeatRate: buyerIds.length ? repeaters / buyerIds.length : null },
    communes: [...communes.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    delivery,
    fairHours: [...fairHours.values()].sort((a, b) => a.hour - b.hour),
    weekdays: [...weekdays.values()],
    fairs,
    missingCost: current.missingCost,
    commissionsMissing:
      (channel !== "online" && settings.mpFeriaPct === 0 && orders.some((o) => o.channel === "feria")) ||
      (channel !== "feria" && settings.mpTiendaPct === 0 && orders.some((o) => o.channel === "online")),
  };
}
