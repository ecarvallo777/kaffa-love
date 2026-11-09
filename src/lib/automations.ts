import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { logEvent } from "@/lib/events";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { clp } from "@/lib/catalog-utils";
import { grindLabel } from "@/lib/grinds";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { PAID_STATUSES } from "@/lib/admin-data";
import type { Grind } from "@/lib/catalog-types";

/*
 * Correos automáticos para vender más (docs/VENTAS-Y-AGENTES.md):
 *  - Carrito abandonado: reserva vencida sin pago → "tu café te está esperando".
 *  - Recompra: N días después de comprar café → "¿se te está acabando?".
 * Solo a clientes que aceptaron novedades, una vez por pedido, sin insistir:
 * no se envían si el cliente ya compró después, y hay un mínimo de días entre correos.
 * Los ejecuta la tarea periódica (/api/cron/expirar-reservas).
 */

const MAX_PER_RUN = 20;

/**
 * La base de datos es una sola para producción y pruebas: si el sitio de
 * pruebas (Preview) o el equipo local también enviaran, los clientes reales
 * recibirían correos con enlaces que no son kaffalove.cl. Solo producción
 * envía, salvo que se active a propósito con AUTOMATION_EMAILS=on.
 */
export const automationsActive = () => process.env.VERCEL_ENV === "production" || process.env.AUTOMATION_EMAILS === "on";
const DAY = 86400_000;

type Item = { product_id: string; product_name: string; quantity: number; unit_price_clp: number; grind: Grind | null };
type Customer = { id: string; email: string; name: string | null; marketing_consent: boolean };
type Row = { id: string; number: number; created_at: string; paid_at: string | null; customer_id: string; customers: Customer; order_items: Item[] };

const ORDER_SELECT = "id, number, created_at, paid_at, customer_id, customers!inner (id, email, name, marketing_consent), order_items (product_id, product_name, quantity, unit_price_clp, grind)";

/** Ya se envió este tipo de correo para este pedido, o al cliente en los últimos `days` días */
async function alreadyContacted(type: string, orderId: string, customerId: string, days: number) {
  const db = createAdminClient();
  const [{ count: forOrder }, { count: recent }] = await Promise.all([
    db.from("events").select("id", { count: "exact", head: true }).eq("type", type).eq("entity_id", orderId),
    db
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("type", type)
      .eq("data->>customer_id", customerId)
      .gte("created_at", new Date(Date.now() - days * DAY).toISOString()),
  ]);
  return (forOrder ?? 0) > 0 || (recent ?? 0) > 0;
}

/** El cliente pagó otro pedido online después de esta fecha */
async function boughtSince(customerId: string, sinceIso: string, exceptOrderId: string) {
  const { count } = await createAdminClient()
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("channel", "online")
    .in("status", PAID_STATUSES)
    .gt("created_at", sinceIso)
    .neq("id", exceptOrderId);
  return (count ?? 0) > 0;
}

function itemsTable(items: Item[]) {
  return `<table width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0">${items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.quantity} × ${escapeHtml(i.product_name)}${
          i.grind ? ` <span style="color:#8b7c70">(molienda ${grindLabel(i.grind)?.toLowerCase()})</span>` : ""
        }</td><td align="right">${clp(i.unit_price_clp * i.quantity)}</td></tr>`,
    )
    .join("")}</table>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#b4432c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">${label}</a></p>`;

const footer = (email: string) =>
  `<p style="color:#8b7c70;font-size:12px;margin-top:28px">Te escribimos porque aceptaste recibir novedades de Kaffa Love. <a href="${unsubscribeUrl(email)}" style="color:#8b7c70">Dejar de recibir estos correos</a>.</p>`;

const firstName = (c: Pick<Customer, "name">) => c.name?.trim().split(" ")[0] ?? "";

// Plantillas -----------------------------------------------------------------------------

type Coffee = { slug: string; name: string; active: boolean; visible_online: boolean };

export function abandonEmail(c: Pick<Customer, "email" | "name">, items: Item[], orderId: string) {
  const name = firstName(c);
  return {
    subject: "Tu café te está esperando",
    html: emailLayout(
      `${name ? `${escapeHtml(name)}, t` : "T"}u café te está esperando`,
      `<p>Dejaste estos productos en tu carrito y no alcanzaste a pagar. Los guardamos para que retomes tu compra con un clic:</p>
${itemsTable(items)}
${button(`${siteUrl()}/carrito/recuperar?pedido=${orderId}&origen=abandono`, "Retomar mi compra")}
<p style="color:#8b7c70;font-size:13px">Los precios y el stock se confirman al pagar. Si tuviste algún problema con el pago, responde este correo y te ayudamos.</p>
${footer(c.email)}`,
    ),
  };
}

export function repurchaseEmail(c: Pick<Customer, "email" | "name">, coffeeItems: Item[], orderId: string, main: Coffee, days: number) {
  const name = firstName(c);
  const shortName = main.name.split(",")[0];
  const stillSold = main.active && main.visible_online;
  const more = `<a href="${siteUrl()}/categoria/cafe-de-especialidad" style="color:#b4432c">Mira los cafés de esta temporada</a>`;
  return {
    subject: `¿Se te está acabando el ${shortName}?`,
    html: emailLayout(
      `¿Se te está acabando el ${escapeHtml(shortName)}?`,
      `<p>${name ? `Hola ${escapeHtml(name)}: h` : "H"}ace unas semanas te llevaste:</p>
${itemsTable(coffeeItems)}
<p>Una bolsa de 250 g rinde más o menos ${days} días de café diario. Si quieres repetir, lo dejamos listo con la misma molienda:</p>
${button(`${siteUrl()}/carrito/recuperar?pedido=${orderId}&origen=recompra`, "Repetir mi pedido")}
<p>${stillSold ? `¿Quieres probar algo distinto? ${more} o <a href="${siteUrl()}/producto/${main.slug}#receta" style="color:#b4432c">la receta de tu café</a>.` : `${more}.`}</p>
${footer(c.email)}`,
    ),
  };
}

/** Envía un ejemplo de cada correo (con el último pedido online real que tenga café) a `to` */
export async function sendAutomationSamples(to: string, name: string | null) {
  const db = createAdminClient();
  const [{ data: orders }, { data: coffees }, settings] = await Promise.all([
    db
      .from("orders")
      .select("id, order_items (product_id, product_name, quantity, unit_price_clp, grind)")
      .eq("channel", "online")
      .order("created_at", { ascending: false })
      .limit(30),
    db.from("products").select("id, slug, name, active, visible_online").eq("type", "cafe"),
    getSettings(),
  ]);
  const coffeeById = new Map((coffees ?? []).map((p) => [p.id, p]));
  const order = (orders ?? []).find((o) => (o.order_items as Item[]).some((i) => coffeeById.has(i.product_id)));
  if (!order) return { error: "Aún no hay pedidos online con café para armar el ejemplo." };
  const items = order.order_items as Item[];
  const coffeeItems = items.filter((i) => coffeeById.has(i.product_id));
  const who = { email: to, name };
  const mails = [abandonEmail(who, items, order.id), repurchaseEmail(who, coffeeItems, order.id, coffeeById.get(coffeeItems[0].product_id)!, settings.repurchaseDays)];
  for (const m of mails) {
    const ok = await sendEmail({ to, subject: `[Ejemplo] ${m.subject}`, html: m.html });
    if (!ok) return { error: "No se pudo enviar: revisa RESEND_API_KEY y EMAIL_FROM en este entorno." };
  }
  return { ok: true as const };
}

// Carrito abandonado ----------------------------------------------------------------

export async function runAbandonedCartEmails() {
  const settings = await getSettings();
  if (!automationsActive() || !settings.emailAbandonedCart) return 0;
  const now = Date.now();
  const { data } = await createAdminClient()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("channel", "online")
    .eq("status", "expirado")
    .eq("customers.marketing_consent", true)
    .gte("created_at", new Date(now - 48 * 3600_000).toISOString())
    .lte("created_at", new Date(now - 3600_000).toISOString())
    .order("created_at")
    .limit(100);

  let sent = 0;
  for (const o of (data ?? []) as unknown as Row[]) {
    if (sent >= MAX_PER_RUN) break;
    if (!o.order_items.length) continue;
    if (await alreadyContacted("correo_abandono", o.id, o.customer_id, 7)) continue;
    if (await boughtSince(o.customer_id, o.created_at, o.id)) continue;

    const c = o.customers;
    const ok = await sendEmail({ to: c.email, ...abandonEmail(c, o.order_items, o.id) });
    if (!ok) break; // correo no configurado o error: se reintenta en la próxima ejecución
    await logEvent("correo_abandono", "order", o.id, { customer_id: o.customer_id, pedido: o.number });
    sent++;
  }
  return sent;
}

// Recompra ------------------------------------------------------------------------------

export async function runRepurchaseEmails() {
  const settings = await getSettings();
  if (!automationsActive() || !settings.emailRepurchase) return 0;
  const days = Math.max(5, settings.repurchaseDays || 18);
  const now = Date.now();
  const db = createAdminClient();
  const [{ data }, { data: coffees }] = await Promise.all([
    db
      .from("orders")
      .select(ORDER_SELECT)
      .eq("channel", "online")
      .in("status", PAID_STATUSES)
      .eq("customers.marketing_consent", true)
      .gte("paid_at", new Date(now - (days + 5) * DAY).toISOString())
      .lte("paid_at", new Date(now - days * DAY).toISOString())
      .order("paid_at")
      .limit(100),
    db.from("products").select("id, slug, name, active, visible_online").eq("type", "cafe"),
  ]);
  const coffeeById = new Map((coffees ?? []).map((p) => [p.id, p]));

  let sent = 0;
  for (const o of (data ?? []) as unknown as Row[]) {
    if (sent >= MAX_PER_RUN) break;
    const coffeeItems = o.order_items.filter((i) => coffeeById.has(i.product_id));
    if (!coffeeItems.length) continue;
    if (await alreadyContacted("correo_recompra", o.id, o.customer_id, 14)) continue;
    if (await boughtSince(o.customer_id, o.paid_at ?? o.created_at, o.id)) continue;

    const c = o.customers;
    const ok = await sendEmail({ to: c.email, ...repurchaseEmail(c, coffeeItems, o.id, coffeeById.get(coffeeItems[0].product_id)!, days) });
    if (!ok) break;
    await logEvent("correo_recompra", "order", o.id, { customer_id: o.customer_id, pedido: o.number, dias: days });
    sent++;
  }
  return sent;
}
