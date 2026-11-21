import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { clp } from "@/lib/catalog-utils";
import { loadServerCart, saveServerCart, type StoredCartLine } from "@/lib/server-cart";
import type { Grind } from "@/lib/catalog-types";

/*
 * Carrito armado desde el admin (Admin → Clientes) y enlace de acceso directo.
 * El correo trae un enlace firmado (7 días) que entra a la cuenta del cliente sin contraseña
 * y lo deja en el pago con su carrito: solo tiene que pagar. Si el cliente no tenía cuenta,
 * se le crea. Los precios y el stock se validan de nuevo al pagar.
 */

const DAYS = 7;
const GRIND_LABEL: Record<Grind, string> = { grano: "En grano", fina: "Molienda fina", media: "Molienda media", gruesa: "Molienda gruesa" };

function secret() {
  const s = process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("Falta SUPABASE_SECRET_KEY");
  return `carrito-acceso:${s}`;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Enlace firmado: cliente + vencimiento */
export function accessToken(customerId: string, days = DAYS) {
  const payload = Buffer.from(JSON.stringify({ c: customerId, e: Date.now() + days * 86400_000, n: randomUUID().slice(0, 8) })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Devuelve el id del cliente si el enlace es válido y no venció */
export function readAccessToken(token: string): { customerId: string } | { error: "invalido" | "vencido" } {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return { error: "invalido" };
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { error: "invalido" };
  try {
    const { c, e } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { c: string; e: number };
    if (typeof c !== "string" || typeof e !== "number") return { error: "invalido" };
    return Date.now() > e ? { error: "vencido" } : { customerId: c };
  } catch {
    return { error: "invalido" };
  }
}

export type CartItemInput = { productId: string; qty: number; grind: Grind | null };

/** Arma el carrito del cliente con los datos actuales de cada producto */
export async function setCustomerCart(customerId: string, items: CartItemInput[]) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const { data: products, error } = ids.length
    ? await createAdminClient().from("products").select("id, slug, name, type, price_clp, track_stock, stock, active").in("id", ids)
    : { data: [], error: null };
  if (error) throw new Error(error.message);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const lines: StoredCartLine[] = [];
  for (const i of items) {
    const p = byId.get(i.productId);
    if (!p || !p.active) throw new Error("Un producto del carrito ya no está disponible.");
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > 50) throw new Error(`Revisa la cantidad de ${p.name}.`);
    const grind = p.type === "cafe" ? (i.grind ?? "grano") : null;
    const key = `${p.id}:${grind ?? "-"}`;
    const existing = lines.find((l) => l.key === key);
    if (existing) existing.qty += i.qty;
    else lines.push({ key, productId: p.id, slug: p.slug, name: p.name, priceClp: p.price_clp, grind, qty: i.qty, maxQty: p.track_stock ? p.stock : null });
  }
  await saveServerCart(customerId, lines);
  return lines;
}

export async function getCustomerCart(customerId: string) {
  return loadServerCart(customerId);
}

/** Crea la cuenta si no existe y envía el correo con el carrito y el enlace de acceso directo */
export async function sendCartEmail(customerId: string, note: string) {
  const db = createAdminClient();
  const { data: c, error } = await db.from("customers").select("id, email, name, auth_user_id").eq("id", customerId).single();
  if (error || !c) throw new Error("No encontramos el cliente.");
  const lines = await loadServerCart(customerId);
  if (!lines.length) throw new Error("El carrito está vacío.");

  // Sin cuenta: se crea (sin contraseña; entra con el enlace o la crea después con «Olvidé mi contraseña»)
  if (!c.auth_user_id) {
    const { data: created, error: e } = await db.auth.admin.createUser({ email: c.email, email_confirm: true });
    if (created?.user) await db.from("customers").update({ auth_user_id: created.user.id }).eq("id", c.id);
    else if (e && !/already|registered|exists/i.test(e.message)) throw new Error(`No se pudo crear la cuenta: ${e.message}`);
  }

  const site = siteUrl();
  const link = `${site}/cuenta/acceso?t=${encodeURIComponent(accessToken(c.id))}`;
  const word = c.name?.trim().split(/\s+/)[0];
  const first = word ? word.charAt(0).toLocaleUpperCase("es") + word.slice(1).toLocaleLowerCase("es") : null;
  const total = lines.reduce((s, l) => s + l.priceClp * l.qty, 0);
  const rows = lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0">${l.qty} × ${escapeHtml(l.name)}${l.grind ? `<br><span style="color:#8b7c70;font-size:13px">${GRIND_LABEL[l.grind]}</span>` : ""}</td><td style="padding:6px 0;text-align:right;white-space:nowrap">${clp(l.priceClp * l.qty)}</td></tr>`,
    )
    .join("");

  const ok = await sendEmail({
    to: c.email,
    subject: "Tu pedido de Kaffa Love está listo para pagar",
    html: emailLayout(
      `${first ? `${first}, t` : "T"}u pedido está listo`,
      `${note.trim() ? `<p>${escapeHtml(note.trim()).replace(/\n/g, "<br>")}</p>` : "<p>Te dejamos tu pedido armado en la tienda. Solo tienes que revisarlo y pagar.</p>"}
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:15px">${rows}<tr><td style="padding:10px 0;border-top:1px solid #dacdb9"><b>Subtotal</b></td><td style="padding:10px 0;border-top:1px solid #dacdb9;text-align:right"><b>${clp(total)}</b></td></tr></table>
<p style="color:#8b7c70;font-size:13px">El despacho se calcula al pagar según tu dirección (o retira sin costo).</p>
<p style="margin:24px 0"><a href="${link}" style="background:#387b4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Revisar y pagar</a></p>
<p style="color:#8b7c70;font-size:13px">El botón entra directo a tu cuenta y vale por ${DAYS} días. Después puedes ingresar en <a href="${site}/cuenta" style="color:#8b7c70">${site.replace(/^https?:\/\//, "")}/cuenta</a> con tu correo (si no tienes contraseña, usa «Olvidé mi contraseña»).</p>`,
    ),
  });
  if (!ok) throw new Error("No se pudo enviar el correo (revisa la configuración de Resend).");
  return { email: c.email, lines: lines.length, total };
}
