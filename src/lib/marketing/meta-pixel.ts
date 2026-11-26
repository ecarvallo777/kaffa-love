import "server-only";
import { createHash } from "node:crypto";
import { cacheLife, cacheTag } from "next/cache";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { logEvent } from "@/lib/events";
import { getStaffOrderIds } from "@/lib/profit";
import { siteUrl } from "@/lib/env";
import type { OrderWithDetails } from "@/lib/orders";

/*
 * Píxel de Meta y API de conversiones (para los anuncios con el catálogo en Instagram y Facebook).
 *
 * - El navegador carga el píxel solo si la persona acepta las cookies de publicidad
 *   (aviso en la tienda): vistas de producto, agregar al carrito, inicio de pago y compra.
 * - La compra también se envía desde el servidor al confirmarse el pago, aunque el cliente
 *   cierre la página. Ambas llevan el mismo id de evento y Meta las cuenta una sola vez.
 *   Solo se envía si la persona aceptó las cookies (queda registrado al crear el pedido).
 * - Los ids de producto son los mismos del catálogo (feed /feed/productos.xml): así Meta
 *   sabe qué producto vio cada persona y puede mostrárselo en los anuncios.
 *
 * Configuración: Admin → Marketing. El id del píxel en config/meta-pixel.json; el token en
 * config/clave-meta-pixel.json (fuera del respaldo).
 */

const GRAPH = process.env.META_GRAPH_URL || "https://graph.facebook.com/v27.0";
const CONFIG_FILE = "meta-pixel.json";
const TOKEN_FILE = "clave-meta-pixel.json";
export { CONSENT_COOKIE } from "@/lib/meta-events";

type PixelConfig = { pixelId: string; name: string | null; testEventCode: string | null; connectedAt: string; by: string; lastPurchaseAt?: string | null; lastError?: string | null };

export function isProduction() {
  return process.env.VERCEL_ENV === "production" || process.env.META_PIXEL_FORCE === "1";
}

export async function getMetaPixelConfig() {
  return readConfigJson<PixelConfig | null>(CONFIG_FILE, null);
}

/** Id del píxel para la tienda (en caché; cambia al conectar o quitar). Solo en producción. */
export async function getStorePixelId(): Promise<string | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("meta-pixel");
  if (!isProduction()) return null;
  const config = await getMetaPixelConfig().catch(() => null);
  return config?.pixelId ?? null;
}

async function graph(path: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}${path}`, { ...init, signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & Record<string, unknown>;
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Meta respondió ${res.status}`);
  return json;
}

/** Verifica que el token pueda enviar eventos a ese píxel y guarda la conexión */
export async function connectMetaPixel(pixelId: string, token: string, testEventCode: string | null, by: string) {
  if (!/^\d{5,25}$/.test(pixelId)) throw new Error("El ID del conjunto de datos (píxel) son solo números.");
  if (!token) throw new Error("Falta el token de acceso.");
  // El token de la API de conversiones solo permite enviar eventos (no leer el píxel):
  // se verifica enviando una vista de prueba, que Meta deja solo en «Probar eventos»
  try {
    const res = await graph(`/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        test_event_code: testEventCode || "TEST_CONEXION",
        data: [
          {
            event_name: "PageView",
            event_time: Math.floor(Date.now() / 1000),
            event_id: `conexion-${Date.now()}`,
            action_source: "website",
            event_source_url: siteUrl(),
            user_data: { country: [sha("cl")], client_user_agent: "Kaffa Love (verificación de conexión)", client_ip_address: "200.1.1.1" },
          },
        ],
      }),
    });
    if (!Number(res.events_received)) throw new Error("no confirmó la recepción del evento");
  } catch (e) {
    throw new Error(`Meta no aceptó el ID y el token: ${(e as Error).message}`);
  }
  // El nombre es opcional: solo se puede leer si el token tiene permiso para eso
  const name = await graph(`/${pixelId}?fields=name&access_token=${encodeURIComponent(token)}`)
    .then((i) => (typeof i.name === "string" ? i.name : null))
    .catch(() => null);
  await writeConfigJson(TOKEN_FILE, { token, savedAt: new Date().toISOString() });
  await writeConfigJson(CONFIG_FILE, { pixelId, name, testEventCode, connectedAt: new Date().toISOString(), by, lastPurchaseAt: null, lastError: null } satisfies PixelConfig);
  return { name };
}

export async function disconnectMetaPixel() {
  const db = createAdminClient();
  await db.storage.from("config").remove([CONFIG_FILE, TOKEN_FILE]);
}

async function updateConfig(change: (c: PixelConfig) => void) {
  const c = await getMetaPixelConfig();
  if (!c) return;
  change(c);
  await writeConfigJson(CONFIG_FILE, c);
}

// Envío de eventos ----------------------------------------------------------------

const sha = (v: string) => createHash("sha256").update(v).digest("hex");
const norm = (v: string | null | undefined) =>
  (v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** Teléfono chileno en formato internacional sin "+" (569XXXXXXXX) */
function phoneE164(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("56")) return d;
  if (d.length === 9) return `56${d}`;
  return d;
}

export type MetaEvent = {
  event_name: string;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url?: string;
  user_data: Record<string, string | string[]>;
  custom_data?: Record<string, unknown>;
};

async function sendEvents(events: MetaEvent[], opts: { testEventCode?: string | null } = {}) {
  const [config, secret] = await Promise.all([getMetaPixelConfig(), readConfigJson<{ token?: string } | null>(TOKEN_FILE, null)]);
  if (!config?.pixelId || !secret?.token) return { sent: false as const, reason: "sin conexión" };
  // Fuera de producción (master, local) solo se envía como evento de prueba
  const testEventCode = opts.testEventCode ?? (isProduction() ? null : config.testEventCode);
  if (!isProduction() && !testEventCode) return { sent: false as const, reason: "fuera de producción" };
  const body = { data: events, access_token: secret.token, ...(testEventCode ? { test_event_code: testEventCode } : {}) };
  const json = await graph(`/${config.pixelId}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { sent: true as const, received: Number(json.events_received ?? 0) };
}

/** Datos del navegador para atribuir la compra a un anuncio; se guardan al crear el pedido solo si aceptó las cookies */
export type MetaAttribution = { fbp: string | null; fbc: string | null; ua: string | null; ip: string | null };

export async function saveAttribution(orderId: string, a: MetaAttribution) {
  await logEvent("meta_atribucion", "order", orderId, a);
}

async function getAttribution(orderId: string): Promise<MetaAttribution | null> {
  const { data } = await createAdminClient()
    .from("events")
    .select("data")
    .eq("type", "meta_atribucion")
    .eq("entity_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.data as MetaAttribution | undefined) ?? null;
}

export const purchaseEventId = (orderId: string) => `compra-${orderId}`;

type Item = { product_id: string; quantity: number; unit_price_clp: number };

export function purchaseEvent(order: OrderWithDetails, a: MetaAttribution): MetaEvent {
  const customer = order.customers as { email?: string | null; name?: string | null; phone?: string | null } | null;
  const items = order.order_items as Item[];
  const [first, ...rest] = (customer?.name ?? "").trim().split(/\s+/);
  const address = order.shipping_address as { commune?: string | null } | null;
  const user: Record<string, string | string[]> = { country: [sha("cl")] };
  if (customer?.email) user.em = [sha(customer.email.trim().toLowerCase())];
  const ph = phoneE164(customer?.phone);
  if (ph) user.ph = [sha(ph)];
  if (norm(first)) user.fn = [sha(norm(first))];
  if (norm(rest.at(-1))) user.ln = [sha(norm(rest.at(-1)))];
  if (norm(address?.commune)) user.ct = [sha(norm(address?.commune))];
  if (order.customer_id) user.external_id = [sha(String(order.customer_id))];
  if (a.fbp) user.fbp = a.fbp;
  if (a.fbc) user.fbc = a.fbc;
  if (a.ip) user.client_ip_address = a.ip;
  if (a.ua) user.client_user_agent = a.ua;

  return {
    event_name: "Purchase",
    event_time: Math.floor(new Date(order.paid_at ?? Date.now()).getTime() / 1000),
    event_id: purchaseEventId(order.id),
    action_source: "website",
    event_source_url: `${siteUrl()}/checkout`,
    user_data: user,
    custom_data: {
      currency: "CLP",
      value: order.total_clp,
      content_type: "product",
      content_ids: [...new Set(items.map((i) => i.product_id))],
      contents: items.map((i) => ({ id: i.product_id, quantity: i.quantity, item_price: i.unit_price_clp })),
      num_items: items.reduce((s, i) => s + i.quantity, 0),
      order_id: order.id,
    },
  };
}

/**
 * Envía la compra a Meta desde el servidor. Nunca rompe la confirmación del pago.
 * Se omite si el cliente no aceptó las cookies, si es una compra con precio equipo o si no es online.
 */
export async function sendMetaPurchase(order: OrderWithDetails) {
  try {
    if (order.channel !== "online") return;
    const [attribution, staff] = await Promise.all([getAttribution(order.id), getStaffOrderIds([order.id])]);
    if (!attribution || staff.has(order.id)) return;
    const res = await sendEvents([purchaseEvent(order, attribution)]);
    if (res.sent) await updateConfig((c) => ((c.lastPurchaseAt = new Date().toISOString()), (c.lastError = null)));
  } catch (e) {
    console.error("[meta] compra:", (e as Error).message);
    await updateConfig((c) => (c.lastError = `${new Date().toISOString()} · ${(e as Error).message}`)).catch(() => {});
  }
}

/** Igual que sendMetaPurchase, pero después de responder (no demora el aviso de Mercado Pago ni la página) */
export function queueMetaPurchase(order: OrderWithDetails) {
  try {
    after(() => sendMetaPurchase(order));
  } catch {
    void sendMetaPurchase(order);
  }
}

/** Evento de prueba desde Admin → Marketing (aparece en Administrador de eventos → Probar eventos) */
export async function sendMetaTestEvent(testEventCode: string) {
  const res = await sendEvents(
    [
      {
        event_name: "PageView",
        event_time: Math.floor(Date.now() / 1000),
        event_id: `prueba-${Date.now()}`,
        action_source: "website",
        event_source_url: siteUrl(),
        user_data: { country: [sha("cl")], client_user_agent: "Kaffa Love (prueba desde el admin)", client_ip_address: "200.1.1.1" },
      },
    ],
    { testEventCode },
  );
  if (!res.sent) throw new Error(`No se envió: ${res.reason}.`);
  return res.received;
}
