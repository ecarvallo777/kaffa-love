import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Grind, Product } from "@/lib/catalog-types";
import { logEvent } from "@/lib/events";
import { refreshCatalog } from "@/lib/catalog-revalidate";
import { getSettings, shippingQuote } from "@/lib/settings";
import { REGIONES } from "@/lib/chile";
import { clp } from "@/lib/catalog-utils";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { grindLabel } from "@/lib/grinds";
import { siteUrl } from "@/lib/env";

export const RESERVATION_MINUTES = 30;
const GRINDS: Grind[] = ["grano", "fina", "media", "gruesa"];
const MAX_QTY_PER_LINE = 50;

export type LineInput = { productId: string; grind: Grind | null; qty: number };

export type PricedLine = {
  product: Product;
  grind: Grind | null;
  qty: number;
  unitPriceClp: number;
  totalClp: number;
};

export const orderLabel = (n: number) => `#${String(n).padStart(5, "0")}`;

// Stock -----------------------------------------------------------------------

/** Libera reservas vencidas. Se llama antes de vender y desde el cron. */
export async function expirePendingOrders() {
  const { data, error } = await createAdminClient().rpc("expire_pending_orders");
  if (error) {
    console.error("[orders] expire_pending_orders:", error.message);
    return 0;
  }
  if (data > 0) refreshCatalog();
  return data as number;
}

/**
 * Precios y disponibilidad ACTUALES desde la base de datos (sin caché).
 * Lo que diga el navegador sobre precios se ignora.
 */
export async function priceLines(lines: LineInput[], channel: "online" | "feria") {
  const problems: string[] = [];
  const clean = lines.filter((l) => l && typeof l.productId === "string" && l.qty > 0);
  if (!clean.length) return { lines: [] as PricedLine[], subtotal: 0, problems: ["El carrito está vacío."] };

  const db = createAdminClient();
  const ids = [...new Set(clean.map((l) => l.productId))];
  const { data: products, error } = await db
    .from("products")
    .select(
      "id, name, slug, type, category_id, description, origin, process, variety, tasting_notes, price_clp, track_stock, stock, low_stock_threshold, image_urls, active, visible_online",
    )
    .in("id", ids);
  if (error) throw new Error(error.message);

  const { data: bundleItems } = await db
    .from("bundle_items")
    .select("bundle_id, product_id, quantity, products:product_id (name, stock, track_stock)")
    .in("bundle_id", ids);

  const priced: PricedLine[] = [];
  const needs = new Map<string, { qty: number; stock: number; name: string }>();
  const need = (id: string, name: string, stock: number, qty: number) => {
    const cur = needs.get(id) ?? { qty: 0, stock, name };
    cur.qty += qty;
    needs.set(id, cur);
  };

  for (const l of clean) {
    const p = products?.find((x) => x.id === l.productId);
    const sellable =
      p && p.active && (channel === "feria" ? true : p.visible_online && p.type !== "preparado");
    if (!p || !sellable) {
      problems.push("Uno de los productos ya no está disponible.");
      continue;
    }
    const qty = Math.min(Math.floor(l.qty), MAX_QTY_PER_LINE);
    let grind: Grind | null = null;
    if (p.type === "cafe") {
      if (!l.grind || !GRINDS.includes(l.grind)) {
        problems.push(`Elige la molienda de ${p.name}.`);
        continue;
      }
      grind = l.grind;
    }
    priced.push({
      product: p as Product,
      grind,
      qty,
      unitPriceClp: p.price_clp,
      totalClp: p.price_clp * qty,
    });

    if (p.type === "promocion") {
      for (const b of bundleItems?.filter((x) => x.bundle_id === p.id) ?? []) {
        const comp = b.products as unknown as { name: string; stock: number; track_stock: boolean };
        if (comp?.track_stock) need(b.product_id, comp.name, comp.stock, b.quantity * qty);
      }
    } else if (p.track_stock) {
      need(p.id, p.name, p.stock, qty);
    }
  }

  for (const n of needs.values()) {
    if (n.qty > n.stock) {
      problems.push(
        n.stock === 0
          ? `${n.name} se agotó.`
          : `Solo quedan ${n.stock} de ${n.name} (pediste ${n.qty}).`,
      );
    }
  }

  const subtotal = priced.reduce((s, l) => s + l.totalClp, 0);
  return { lines: priced, subtotal, problems };
}

/** Reserva el stock de un pedido; si falta, borra el pedido y explica qué faltó */
export async function reserveOrDelete(orderId: string) {
  const db = createAdminClient();
  let { error } = await db.rpc("reserve_order_stock", { p_order_id: orderId });
  // Si falta stock, puede estar retenido por reservas vencidas: se liberan y se reintenta
  if (error && /SIN_STOCK/.test(error.message) && (await expirePendingOrders()) > 0) {
    ({ error } = await db.rpc("reserve_order_stock", { p_order_id: orderId }));
  }
  if (!error) return null;

  await db.from("orders").delete().eq("id", orderId);
  const missing = /SIN_STOCK:([0-9a-f-]{36})/.exec(error.message)?.[1];
  if (missing) {
    const { data } = await db.from("products").select("name").eq("id", missing).maybeSingle();
    return `${data?.name ?? "Un producto"} se agotó mientras comprabas.`;
  }
  console.error("[orders] reserve_order_stock:", error.message);
  return "No pudimos reservar el stock. Intenta de nuevo.";
}

// Pedido online -----------------------------------------------------------------

export type CheckoutInput = {
  email: string;
  name: string;
  phone: string;
  marketing: boolean;
  delivery: "retiro" | "despacho";
  pickupLocationId?: string;
  address?: {
    street: string;
    number: string;
    apartment?: string;
    commune: string;
    region: string;
    notes?: string;
  };
  lines: LineInput[];
};

export type CheckoutResult =
  | { ok: true; orderId: string; orderNumber: number; totalClp: number }
  | { ok: false; errors: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateCheckout(input: CheckoutInput): string[] {
  const e: string[] = [];
  if (!EMAIL_RE.test(input.email?.trim() ?? "")) e.push("Ingresa un correo válido.");
  if ((input.name?.trim().length ?? 0) < 2) e.push("Ingresa tu nombre.");
  if ((input.phone?.replace(/\D/g, "").length ?? 0) < 8) e.push("Ingresa un teléfono válido.");
  if (input.delivery === "retiro" && !input.pickupLocationId) e.push("Elige dónde retirar.");
  if (input.delivery === "despacho") {
    const a = input.address;
    if (!a?.street?.trim()) e.push("Ingresa la calle.");
    if (!a?.number?.trim()) e.push("Ingresa el número de la dirección.");
    if (!a?.commune?.trim()) e.push("Ingresa la comuna.");
    if (!a?.region || !(REGIONES as readonly string[]).includes(a.region)) e.push("Elige la región.");
  }
  if (input.delivery !== "retiro" && input.delivery !== "despacho") e.push("Elige cómo recibir tu pedido.");
  return e;
}

export async function createOnlineOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const errors = validateCheckout(input);
  if (errors.length) return { ok: false, errors };

  let priced = await priceLines(input.lines, "online");
  if (priced.problems.length && (await expirePendingOrders()) > 0) {
    priced = await priceLines(input.lines, "online");
  }
  if (priced.problems.length) return { ok: false, errors: priced.problems };

  const db = createAdminClient();
  const email = input.email.trim().toLowerCase();

  // Entrega
  let shippingClp = 0;
  let shippingService: string | null = null;
  let pickupLocationId: string | null = null;
  if (input.delivery === "despacho") {
    const quote = shippingQuote(await getSettings(), input.address!.region, priced.subtotal);
    if (!quote) return { ok: false, errors: ["Por ahora no despachamos a esa región. Puedes elegir retiro."] };
    shippingClp = quote.priceClp;
    shippingService = quote.service;
  } else {
    const { data: loc } = await db
      .from("pickup_locations")
      .select("id")
      .eq("id", input.pickupLocationId!)
      .eq("active", true)
      .maybeSingle();
    if (!loc) return { ok: false, errors: ["El lugar de retiro ya no está disponible."] };
    pickupLocationId = loc.id;
  }

  // Cliente (sin cuenta: se identifica por correo)
  const { data: existing } = await db.from("customers").select("id, marketing_consent").eq("email", email).maybeSingle();
  let customerId = existing?.id as string | undefined;
  const consent =
    input.marketing && !existing?.marketing_consent
      ? { marketing_consent: true, marketing_consent_at: new Date().toISOString() }
      : {};
  if (customerId) {
    await db.from("customers").update({ name: input.name.trim(), phone: input.phone.trim(), ...consent }).eq("id", customerId);
  } else {
    const { data: created, error } = await db
      .from("customers")
      .insert({ email, name: input.name.trim(), phone: input.phone.trim(), ...consent })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo registrar el cliente: ${error.message}`);
    customerId = created.id;
  }

  const address =
    input.delivery === "despacho"
      ? {
          street: input.address!.street.trim(),
          number: input.address!.number.trim(),
          apartment: input.address!.apartment?.trim() || null,
          commune: input.address!.commune.trim(),
          region: input.address!.region,
          notes: input.address!.notes?.trim() || null,
        }
      : null;
  if (address) {
    await db.from("addresses").insert({ customer_id: customerId, ...address });
  }

  const reservedUntil = new Date(Date.now() + RESERVATION_MINUTES * 60_000);
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      channel: "online",
      status: "pendiente_pago",
      customer_id: customerId,
      delivery: input.delivery,
      shipping_address: address,
      pickup_location_id: pickupLocationId,
      subtotal_clp: priced.subtotal,
      shipping_clp: shippingClp,
      total_clp: priced.subtotal + shippingClp,
      shipping_service: shippingService,
      reserved_until: reservedUntil.toISOString(),
    })
    .select("id, number, total_clp")
    .single();
  if (orderError) throw new Error(`No se pudo crear el pedido: ${orderError.message}`);

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
    throw new Error(`No se pudo guardar el detalle del pedido: ${itemsError.message}`);
  }

  const stockError = await reserveOrDelete(order.id);
  if (stockError) return { ok: false, errors: [stockError] };

  refreshCatalog();
  await logEvent("pedido_creado", "order", order.id, {
    channel: "online",
    total_clp: order.total_clp,
    delivery: input.delivery,
    items: priced.lines.map((l) => ({ product_id: l.product.id, qty: l.qty, grind: l.grind })),
  });

  return { ok: true, orderId: order.id, orderNumber: order.number, totalClp: order.total_clp };
}

// Lectura -----------------------------------------------------------------------

export async function getOrder(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) return null;
  const { data } = await createAdminClient()
    .from("orders")
    .select(
      "*, customers (email, name, phone, auth_user_id), order_items (id, product_id, product_name, unit_price_clp, quantity, grind), pickup_locations (name, address, hours)",
    )
    .eq("id", orderId)
    .maybeSingle();
  return data;
}

export type OrderWithDetails = NonNullable<Awaited<ReturnType<typeof getOrder>>>;

// Confirmación de pago ------------------------------------------------------------

/**
 * Marca un pedido como pagado. Es idempotente: si Mercado Pago avisa dos veces
 * o el cliente recarga la página de retorno, no pasa nada más.
 */
export async function confirmOrderPaid(orderId: string, paymentId: string, amountClp: number) {
  const db = createAdminClient();
  const order = await getOrder(orderId);
  if (!order) {
    console.error(`[orders] Pago ${paymentId} para pedido inexistente ${orderId}`);
    return;
  }
  if (order.mp_payment_id === paymentId && order.status !== "pendiente_pago") return;

  if (Math.round(amountClp) !== order.total_clp) {
    await logEvent("pago_monto_distinto", "order", orderId, {
      payment_id: paymentId,
      pagado: amountClp,
      esperado: order.total_clp,
    });
  }

  if (order.status === "pendiente_pago") {
    const { data: updated, error } = await db
      .from("orders")
      .update({ status: "pagado", paid_at: new Date().toISOString(), mp_payment_id: paymentId, reserved_until: null, updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pendiente_pago")
      .select("id");
    if (error?.code === "23505") {
      await logEvent("pago_duplicado", "order", orderId, { payment_id: paymentId });
      return;
    }
    if (error) throw new Error(error.message);
    if (updated?.length) {
      await logEvent("pago_confirmado", "order", orderId, { payment_id: paymentId, total_clp: order.total_clp });
      await sendOrderConfirmation(order);
    }
    return;
  }

  if (order.status === "pagado" || order.mp_payment_id) {
    // Ya estaba pagado con otro pago: posible cobro doble
    if (order.mp_payment_id !== paymentId) {
      await logEvent("pago_duplicado", "order", orderId, { payment_id: paymentId, anterior: order.mp_payment_id });
    }
    return;
  }

  // Pago aprobado después de que venció la reserva: el stock ya se liberó
  const { error } = await db
    .from("orders")
    .update({ status: "pagado", paid_at: new Date().toISOString(), mp_payment_id: paymentId, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  await logEvent("pago_tardio", "order", orderId, {
    payment_id: paymentId,
    estado_anterior: order.status,
    nota: "El pago llegó después de liberar el stock. Revisa si hay unidades o coordina con el cliente.",
  });
  await sendOrderConfirmation(order);
}

async function sendOrderConfirmation(order: OrderWithDetails) {
  const customer = order.customers as { email: string; name: string } | null;
  if (!customer?.email) return;
  const items = (order.order_items as { product_name: string; quantity: number; unit_price_clp: number; grind: Grind | null }[])
    .map(
      (i) =>
        `<tr><td style="padding:6px 0">${i.quantity} × ${escapeHtml(i.product_name)}${
          i.grind ? ` <span style="color:#8b7c70">(molienda ${grindLabel(i.grind)?.toLowerCase()})</span>` : ""
        }</td><td align="right">${clp(i.unit_price_clp * i.quantity)}</td></tr>`,
    )
    .join("");
  const pickup = order.pickup_locations as { name: string; address: string; hours: string } | null;
  const delivery =
    order.delivery === "retiro" && pickup
      ? `<p><b>Retiro:</b> ${escapeHtml(pickup.name)}, ${escapeHtml(pickup.address)} · ${escapeHtml(pickup.hours)}. Te avisaremos cuando esté listo.</p>`
      : `<p><b>Despacho:</b> te enviaremos el número de seguimiento cuando salga tu pedido.</p>`;

  await sendEmail({
    to: customer.email,
    subject: `Recibimos tu pedido ${orderLabel(order.number)}`,
    html: emailLayout(
      `¡Gracias, ${customer.name?.split(" ")[0] ?? ""}!`,
      `<p>Tu pago fue aprobado y ya estamos preparando tu pedido <b>${orderLabel(order.number)}</b>.</p>
<table width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0">${items}
<tr><td style="padding:6px 0;color:#8b7c70">Envío</td><td align="right">${clp(order.shipping_clp)}</td></tr>
<tr><td style="padding:6px 0"><b>Total</b></td><td align="right"><b>${clp(order.total_clp)}</b></td></tr></table>
${delivery}
<p><a href="${siteUrl()}/pedido/${order.id}" style="color:#b4432c">Ver el estado de tu pedido</a></p>
<p style="color:#8b7c70;font-size:13px">La boleta te llega directamente desde Mercado Pago.</p>`,
    ),
  });
}

/** Avisos al cliente cuando cambia el estado del pedido */
export async function notifyStatusChange(order: OrderWithDetails, status: string) {
  const customer = order.customers as { email: string; name: string } | null;
  if (!customer?.email || order.channel !== "online") return;
  const pickup = order.pickup_locations as { name: string; address: string; hours: string } | null;
  const messages: Record<string, [string, string] | undefined> = {
    despachado: [
      `Tu pedido ${orderLabel(order.number)} va en camino`,
      `<p>Tu pedido salió hacia ${escapeHtml((order.shipping_address as { commune?: string } | null)?.commune ?? "tu dirección")}.</p>${
        order.tracking_number ? `<p>Número de seguimiento Blue Express: <b>${escapeHtml(order.tracking_number)}</b></p>` : ""
      }`,
    ],
    listo_retiro: [
      `Tu pedido ${orderLabel(order.number)} está listo para retiro`,
      pickup
        ? `<p>Puedes retirarlo en <b>${escapeHtml(pickup.name)}</b>, ${escapeHtml(pickup.address)}.</p><p>Horario: ${escapeHtml(pickup.hours)}</p>`
        : "<p>Ya puedes retirarlo.</p>",
    ],
  };
  const m = messages[status];
  if (!m) return;
  await sendEmail({
    to: customer.email,
    subject: m[0],
    html: emailLayout(m[0], `${m[1]}<p><a href="${siteUrl()}/pedido/${order.id}" style="color:#b4432c">Ver el estado de tu pedido</a></p>`),
  });
}

export function preferenceItems(order: OrderWithDetails) {
  const items = (order.order_items as { product_id: string; product_name: string; quantity: number; unit_price_clp: number; grind: Grind | null }[]).map((i) => ({
    id: i.product_id,
    title: i.grind ? `${i.product_name} (molienda ${grindLabel(i.grind)?.toLowerCase()})` : i.product_name,
    quantity: i.quantity,
    unitPriceClp: i.unit_price_clp,
  }));
  if (order.shipping_clp > 0) {
    items.push({ id: "despacho", title: "Despacho a domicilio", quantity: 1, unitPriceClp: order.shipping_clp });
  }
  return items;
}
