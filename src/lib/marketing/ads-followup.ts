import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { PAID_STATUSES } from "@/lib/admin-data";
import { getSettings } from "@/lib/settings";
import { clp } from "@/lib/catalog-utils";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { fmtDate } from "@/lib/format";
import { siteUrl } from "@/lib/env";

/*
 * Seguimiento de la campaña de anuncios de Meta: un correo a la tienda el día 3,
 * el día 7 y después cada lunes, con lo que trajo el anuncio según la tienda
 * (canal «anuncio_meta»: visitas, carritos, pagos iniciados, compras) y qué hacer.
 * El gasto es estimado con el presupuesto diario (la tienda no lee la cuenta publicitaria).
 * Estado en config/seguimiento-anuncios.json; la campaña se configura en Admin → Marketing.
 */

const FILE = "seguimiento-anuncios.json";
const SOURCE = "anuncio_meta";

export type AdsCampaign = { startDate: string; dailyBudgetClp: number; sent: Record<string, string> };

export async function getAdsCampaign() {
  return readConfigJson<AdsCampaign | null>(FILE, null);
}

export async function setAdsCampaign(startDate: string, dailyBudgetClp: number) {
  const prev = await getAdsCampaign();
  const sent = prev && prev.startDate === startDate ? prev.sent : {};
  await writeConfigJson(FILE, { startDate, dailyBudgetClp, sent } satisfies AdsCampaign);
}

export async function stopAdsCampaign() {
  await createAdminClient().storage.from("config").remove([FILE]);
}

const chileDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" });
const chileHour = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hourCycle: "h23" }).format(d));
const chileWeekday = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", weekday: "short" }).format(d);
/** Inicio del día en Chile (aprox. con el desfase actual) */
const dayStart = (ymd: string) => new Date(`${ymd}T00:00:00-03:00`);

export type AdsStats = { visitors: number; carts: number; checkouts: number; orders: number; revenue: number; days: number; spend: number };

export async function adsStats(c: AdsCampaign, now = new Date()): Promise<AdsStats> {
  const db = createAdminClient();
  const from = dayStart(c.startDate).toISOString();
  const { data: events, error } = await db
    .from("events")
    .select("type, data")
    .in("type", ["vista_producto", "agrego_carrito", "inicio_checkout"])
    .eq("data->>fuente", SOURCE)
    .gte("created_at", from)
    .limit(20000);
  if (error) throw new Error(error.message);
  const uniq = (t: string) => new Set((events ?? []).filter((e) => e.type === t).map((e) => String((e.data as { aid?: string }).aid))).size;

  const { data: created } = await db.from("events").select("entity_id").eq("type", "pedido_creado").eq("data->>fuente", SOURCE).gte("created_at", from);
  const ids = (created ?? []).map((e) => e.entity_id).filter(Boolean) as string[];
  let orders = 0;
  let revenue = 0;
  if (ids.length) {
    const { data } = await db.from("orders").select("id, total_clp, shipping_clp").in("id", ids).in("status", PAID_STATUSES);
    orders = data?.length ?? 0;
    revenue = (data ?? []).reduce((s, o) => s + o.total_clp - (o.shipping_clp ?? 0), 0);
  }
  const days = Math.max(1, Math.ceil((now.getTime() - dayStart(c.startDate).getTime()) / 86400_000));
  return { visitors: uniq("vista_producto"), carts: uniq("agrego_carrito"), checkouts: uniq("inicio_checkout"), orders, revenue, days, spend: days * c.dailyBudgetClp };
}

function advice(kind: string, s: AdsStats) {
  if (s.visitors === 0)
    return "No llegó ninguna visita desde el anuncio. Revisa en el Administrador de anuncios que la campaña diga «Activo» (no «En revisión», «Rechazado» ni «Pausado») y que la forma de pago esté aprobada.";
  if (kind === "dia3")
    return s.carts > 0
      ? "Va bien: hay visitas y gente agregando al carrito. No toques la campaña esta semana; cada cambio reinicia el aprendizaje de Meta."
      : "Llegan visitas pero aún nadie agrega al carrito. Es temprano: no toques la campaña hasta el día 7. Mientras, revisa que las fichas de producto se vean bien en el celular.";
  if (s.orders === 0 && s.carts > 0)
    return "Hay carritos pero ninguna compra. Cambia el evento de conversión del conjunto de anuncios de «Compra» a «Agregar al carrito»: Meta aprenderá más rápido con más señales. Revisa también el costo de envío, que suele frenar la compra.";
  if (s.orders === 0) return "Hay visitas pero nadie agrega al carrito. Puede ser el precio, las fotos o el público. Mándale los números a Claude para revisar qué ajustar.";
  return s.revenue >= s.spend
    ? "Las ventas atribuidas ya superan el gasto estimado. Si el margen lo permite, considera subir el presupuesto un 20 % (no más, para no reiniciar el aprendizaje)."
    : "Hay compras, pero las ventas aún no cubren el gasto estimado. Sigue una semana más antes de decidir: Meta mejora con cada compra.";
}

const TITLES: Record<string, string> = { dia3: "Anuncios de Meta: día 3", dia7: "Anuncios de Meta: primera semana" };

async function sendReport(kind: string, c: AdsCampaign, s: AdsStats) {
  const { contactEmail } = await getSettings();
  if (!contactEmail) return false;
  const row = (k: string, v: string) => `<tr><td style="padding:6px 0;color:#8b7c70">${k}</td><td align="right"><b>${v}</b></td></tr>`;
  const title = TITLES[kind] ?? "Anuncios de Meta: resumen semanal";
  return sendEmail({
    to: contactEmail,
    subject: `${process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production" ? "[PRUEBA] " : ""}${title} · ${s.visitors} visitas, ${s.orders} compras`,
    html: emailLayout(
      title,
      `<p>Desde el ${fmtDate(dayStart(c.startDate))} (${s.days} días), según la tienda:</p>
<table width="100%" style="border-top:1px solid #eee;border-bottom:1px solid #eee;margin:16px 0">
${row("Visitas desde el anuncio", String(s.visitors))}
${row("Agregaron al carrito", String(s.carts))}
${row("Iniciaron el pago", String(s.checkouts))}
${row("Compras", String(s.orders))}
${row("Ventas (sin envío)", clp(s.revenue))}
${row("Gasto estimado", `${clp(s.spend)} <span style="font-weight:normal;color:#8b7c70">(${clp(c.dailyBudgetClp)} × ${s.days} días)</span>`)}
</table>
<p><b>Qué hacer:</b> ${escapeHtml(advice(kind, s))}</p>
<p style="color:#8b7c70;font-size:13px">El gasto real, el alcance y los clics están en el Administrador de anuncios de Meta. Algunas visitas no aparecen aquí si la persona rechazó las cookies o llegó al sitio por otro camino.</p>
<p style="margin:24px 0"><a href="${siteUrl()}/admin/reportes" style="background:#387b4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Ver Reportes</a></p>`,
    ),
  });
}

/** Lo llama la tarea periódica: envía el correo que toque (desde las 9:00 de Chile), una sola vez */
export async function runAdsFollowup(now = new Date()) {
  const c = await getAdsCampaign();
  if (!c || chileHour(now) < 9) return null;
  const today = chileDate.format(now);
  const day = Math.round((dayStart(today).getTime() - dayStart(c.startDate).getTime()) / 86400_000);
  let kind: string | null = null;
  if (day >= 3 && !c.sent.dia3 && day < 7) kind = "dia3";
  else if (day >= 7 && !c.sent.dia7) kind = "dia7";
  else if (day > 7 && chileWeekday(now) === "Mon" && !c.sent[`semana-${today}`]) kind = `semana-${today}`;
  if (!kind) return null;
  // Se marca antes de enviar: si el correo falla, no se repite cada 5 minutos
  c.sent[kind] = now.toISOString();
  await writeConfigJson(FILE, c);
  const stats = await adsStats(c, now);
  await sendReport(kind.startsWith("semana") ? "semana" : kind, c, stats);
  return kind;
}
