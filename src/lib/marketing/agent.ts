import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { getReport, type Report } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { getRecipesFresh } from "@/lib/recipes";
import { getGuidesFresh, saveGuides, type Guide } from "@/lib/guides";
import { usageOf, type ReadUsage } from "@/lib/purchases";
import { logEvent } from "@/lib/events";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { slugify } from "@/lib/slug";
import { automationsActive } from "@/lib/automations";
import { searchQueries } from "@/lib/marketing/search-console";

/*
 * Agente de marketing semanal (docs/VENTAS-Y-AGENTES.md).
 * Cada lunes reúne los datos de la tienda (ventas, canales, embudo, stock, recetas, ferias y,
 * si está conectado, Search Console) y Claude prepara:
 *   - un resumen y 3 acciones concretas para la semana,
 *   - 4 publicaciones de Instagram listas para aprobar,
 *   - el borrador de una guía para kaffalove.cl/guias.
 * Regla del PRD: el agente sugiere y una persona aprueba. Nada se publica solo.
 * Nunca recibe datos personales de clientes. Se revisa en Admin → Marketing.
 */

const STORE = "marketing.json";
const MODEL = "claude-opus-5-5";
const KEEP_WEEKS = 12;
const TZ = "America/Santiago";
const LAUNCH_DATE = "2026-11-16";

export type PostStatus = "pendiente" | "publicado" | "descartado";

export type MarketingPost = {
  format: "post" | "carrusel" | "historia" | "reel";
  day: string;
  goal: string;
  hook: string;
  caption: string;
  hashtags: string[];
  photo: string;
  productSlug: string | null;
  /** Enlace etiquetado para la bio o el sticker de enlace de la historia */
  link: string;
  status: PostStatus;
};

export type MarketingAction = { title: string; why: string; how: string; done: boolean };

export type MarketingRun = {
  id: string;
  /** Lunes de la semana (AAAA-MM-DD, hora de Chile) */
  week: string;
  createdAt: string;
  by: string;
  summary: string;
  actions: MarketingAction[];
  posts: MarketingPost[];
  guideSlug: string | null;
  searchConsole: string;
  usage: ReadUsage;
};

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Lunes de la semana de `d`, en hora de Chile */
export function weekOf(d = new Date()) {
  const local = new Date(`${dayKey(d)}T12:00:00Z`);
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}

export async function getMarketingRuns(): Promise<MarketingRun[]> {
  return readConfigJson<MarketingRun[]>(STORE, []);
}

export async function saveMarketingRuns(runs: MarketingRun[]) {
  await writeConfigJson(STORE, runs.slice(0, KEEP_WEEKS));
}

// --- Datos para el agente (sin datos personales) ------------------------------------

function reportDigest(r: Report) {
  return {
    periodo: `${r.from.slice(0, 10)} a ${r.to.slice(0, 10)}`,
    ventas_brutas_clp: r.current.gross,
    ventas_periodo_anterior_clp: r.previous.gross,
    pedidos: r.current.orders,
    pedidos_periodo_anterior: r.previous.orders,
    ticket_promedio_clp: r.avgTicket,
    productos_mas_vendidos: r.products.slice(0, 8).map((p) => ({ nombre: p.name, unidades: p.units, ventas_clp: p.revenue })),
    embudo_visitantes: { vieron_producto: r.visitors.viewed, agregaron_al_carrito: r.visitors.added, llegaron_al_pago: r.visitors.checkout },
    pedidos_online: { creados: r.funnel.created, fueron_a_pagar: r.funnel.wentToPay, pagados: r.funnel.paid, abandonados: r.funnel.abandoned },
    canales_de_llegada: r.sources.map((s) => ({ canal: s.source, visitantes: s.visitors, pedidos: s.orders, ventas_clp: s.revenue })),
    clientes: { compradores: r.customers.buyers, nuevos: r.customers.newBuyers, recurrentes: r.customers.returning },
    correos_automaticos: r.automations,
    ferias: r.fairs.map((f) => ({ nombre: f.name, fecha: f.date, ventas_clp: f.gross, ventas: f.sales })),
    comunas: r.communes.slice(0, 5),
  };
}

async function buildContext(week: string) {
  const db = createAdminClient();
  const [week7, month30, settings, recipes, guides, runs, products, fairs, search] = await Promise.all([
    getReport("7d", "todos"),
    getReport("30d", "todos"),
    getSettings(),
    getRecipesFresh(),
    getGuidesFresh(),
    getMarketingRuns(),
    db.from("products").select("id, name, slug, type, description, origin, region, farm, altitude, process, variety, tasting_notes, sca_score, price_clp, stock, track_stock, low_stock_threshold, image_urls, active").eq("active", true).neq("type", "preparado"),
    db.from("fair_sessions").select("name, location, opened_at").gte("opened_at", new Date(Date.now() - 120 * 86400_000).toISOString()).order("opened_at", { ascending: false }).limit(20),
    searchQueries(),
  ]);
  if (products.error) throw new Error(products.error.message);
  const catalog = (products.data ?? []).map((p) => ({
    slug: p.slug,
    nombre: p.name,
    tipo: p.type,
    precio_clp: p.price_clp,
    stock: p.track_stock ? p.stock : "sin control",
    stock_bajo: p.track_stock && p.stock <= p.low_stock_threshold,
    con_foto: p.image_urls.length > 0,
    ...(p.type === "cafe"
      ? { origen: p.origin, region: p.region, finca: p.farm, altura: p.altitude, proceso: p.process, variedad: p.variety, notas_de_cata: p.tasting_notes, puntaje_sca: p.sca_score }
      : {}),
    descripcion: p.description?.slice(0, 400) ?? null,
  }));
  const nameOf = new Map((products.data ?? []).map((p) => [p.id, p.name]));

  return {
    context: {
      semana: week,
      hoy: dayKey(new Date()),
      tienda: {
        lanzamiento_tienda_nueva: LAUNCH_DATE,
        reglas: [
          "Hasta unas semanas después del lanzamiento, parte de las visitas y carritos son pruebas de los propios dueños: no los interpretes como clientes que abandonan.",
          "Los correos automáticos (carrito abandonado, recompra y reseña) solo se envían a clientes que aceptaron recibir novedades. Que salgan 0 no es una falla.",
          "El descuento de bienvenida solo aplica a quien llega por el QR de feria, en su primera compra online.",
          "Los pagos son con Mercado Pago y funcionan; no propongas revisar la pasarela salvo que los datos muestren errores de pago.",
        ],
        sitio: siteUrl(),
        instagram: settings.instagram || null,
        descuento_bienvenida_qr_feria_pct: settings.welcomePct,
        despacho_gratis_desde_clp: settings.freeShippingFromClp,
        correo_recompra_dias: settings.repurchaseDays,
      },
      ultimos_7_dias: reportDigest(week7),
      ultimos_30_dias: reportDigest(month30),
      catalogo: catalog,
      recetas: recipes.filter((r) => r.active).map((r) => ({ titulo: r.title, metodo: r.method, molienda: r.grind, cafes: r.productIds.map((id) => nameOf.get(id)).filter(Boolean) })),
      guias_existentes: guides.filter((g) => g.status !== "descartada").map((g) => ({ titulo: g.title, busqueda: g.keyword, estado: g.status })),
      publicaciones_recientes: runs.slice(0, 3).flatMap((r) => r.posts.map((p) => ({ semana: r.week, gancho: p.hook, producto: p.productSlug, estado: p.status }))),
      ferias_recientes: (fairs.data ?? []).map((f) => ({ nombre: f.name, lugar: f.location, fecha: dayKey(new Date(f.opened_at)) })),
      busquedas_google: search.ok ? { desde: search.from, hasta: search.to, consultas: search.rows } : { no_disponible: search.reason },
    },
    searchConsole: search.ok ? `${search.rows.length} búsquedas (${search.from} a ${search.to})` : search.reason,
    slugs: new Set(catalog.map((c) => c.slug)),
    idsBySlug: new Map((products.data ?? []).map((p) => [p.slug, p.id])),
  };
}

// --- Claude ------------------------------------------------------------------------

const OutputSchema = z.object({
  summary: z.string().describe("Resumen de la semana en 3 a 5 frases: qué pasó, qué funciona y qué no, con números."),
  actions: z
    .array(z.object({ title: z.string(), why: z.string().describe("El dato que la justifica"), how: z.string().describe("Pasos concretos, menos de una hora") }))
    .describe("Exactamente 3 acciones"),
  posts: z
    .array(
      z.object({
        format: z.enum(["post", "carrusel", "historia", "reel"]),
        day: z.enum(["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]),
        goal: z.string().describe("Para qué sirve: vender un café, enseñar, llevar a la feria, pedir reseñas…"),
        hook: z.string().describe("Primera línea o texto en pantalla"),
        caption: z.string().describe("Texto completo listo para pegar, con saltos de línea y llamado a la acción"),
        hashtags: z.array(z.string()).describe("5 a 10, sin el #"),
        photo: z.string().describe("Qué foto o video tomar, en concreto"),
        product_slug: z.string().nullable().describe("slug del catálogo si la publicación es sobre un producto"),
      }),
    )
    .describe("Exactamente 4 publicaciones"),
  guide: z
    .object({
      title: z.string(),
      keyword: z.string().describe("La búsqueda de Google a la que responde"),
      description: z.string().describe("Meta description de 140 a 160 caracteres"),
      body: z.string().describe("Markdown simple, 700 a 1.100 palabras, sin el título principal"),
      product_slugs: z.array(z.string()).describe("1 a 3 slugs del catálogo enlazados en el texto"),
    })
    .nullable(),
});

const SYSTEM = `Eres el encargado de marketing de Kaffa Love Roasters 11:11, una tostaduría de café de especialidad de Santiago de Chile: una pareja de tostadores que selecciona granos de altura y los tuesta artesanalmente en pequeños lotes (tueste medio). Venden en su tienda online (kaffalove.cl) y en ferias. Tu trabajo es atraer clientes nuevos y que los actuales vuelvan, con muy poco tiempo de los dueños.

Recibes un JSON con los datos reales de la tienda. Respeta también las reglas de "tienda.reglas". Reglas:
- No inventes datos, premios, testimonios, clientes, descuentos ni promociones. Solo existen los descuentos que aparecen en "tienda" (el de bienvenida es solo para quien llega por el QR de feria). Si quieres proponer una promoción nueva, hazlo como acción para que los dueños decidan, no la anuncies en una publicación.
- Usa solo productos del catálogo con stock (o "sin control"). Prioriza cafés; no promociones un producto agotado. Si un producto con stock bajo se vende bien, puedes usar la escasez real.
- Las notas de cata, origen, proceso, puntaje y recetas salen del catálogo: úsalas tal cual, sin exagerar.
- Si hay pocos datos (tienda recién lanzada), dilo en el resumen y basa las acciones en sentido común para una tostaduría pequeña, sin fingir tendencias.
- Tono: cercano, cálido y experto, en español de Chile neutro (tú, sin modismos forzados ni exceso de emojis: máximo 2 por publicación). Nada de frases genéricas tipo "eleva tu experiencia".
- Hoy es la fecha indicada en "hoy" (hemisferio sur): ten en cuenta la estación y fechas relevantes de Chile.

Acciones (3): concretas, hechas en menos de una hora, y cada una con el dato que la justifica. Ejemplos de buen nivel: "Pide reseñas en la feria del sábado con un cartel con el QR del perfil de Google", "Sube foto al producto X: tiene visitas pero no está en Google Shopping porque no tiene foto".

Publicaciones (4): variadas (no todas de venta: también educar con recetas, el proceso de tueste, dónde estarán en ferias). Instagram no permite enlaces en el texto: termina con un llamado a la acción como "link en la bio" o "escanea el QR en la feria". No repitas ganchos ni productos de "publicaciones_recientes".

Guía (1, o null si no hay un tema que valga la pena): responde una búsqueda real de alguien que quiere preparar o elegir café en casa (si hay "busquedas_google", prioriza consultas con impresiones y posición mayor a 5). No repitas temas de "guias_existentes". Útil de verdad, con medidas concretas (gramos, ml, temperatura, molienda, tiempos), coherente con las recetas del catálogo. Enlaza de 1 a 3 cafés o accesorios con [texto](/producto/slug) donde ayude, sin forzarlo. Formato: solo ## y ### para subtítulos, párrafos, listas con "-" o "1.", **negrita** y enlaces. Sin título principal (se muestra aparte), sin tablas, sin imágenes.`;

async function askClaude(context: unknown) {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high", format: betaZodOutputFormat(OutputSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Datos de la tienda (JSON):\n${JSON.stringify(context)}\n\nPrepara el plan de marketing de esta semana.` }],
  });
  const usage = usageOf(response);
  if (response.stop_reason === "refusal") throw new Error("Claude no pudo preparar el plan.");
  if (response.stop_reason === "max_tokens") throw new Error("La respuesta de Claude quedó incompleta.");
  if (!response.parsed_output) throw new Error("No se pudo leer la respuesta de Claude.");
  return { out: response.parsed_output, usage };
}

// --- Ejecutar -------------------------------------------------------------------------

export async function runMarketingAgent(by: string) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY.");
  const week = weekOf();
  const { context, searchConsole, slugs, idsBySlug } = await buildContext(week);
  const { out, usage } = await askClaude(context);

  const site = siteUrl();
  const utm = `utm_source=instagram&utm_medium=social&utm_campaign=semana-${week}`;
  const posts: MarketingPost[] = out.posts.map((p) => {
    const slug = p.product_slug && slugs.has(p.product_slug) ? p.product_slug : null;
    return {
      format: p.format,
      day: p.day,
      goal: p.goal.trim(),
      hook: p.hook.trim(),
      caption: p.caption.trim(),
      hashtags: p.hashtags.map((h) => h.replace(/^#/, "").trim()).filter(Boolean),
      photo: p.photo.trim(),
      productSlug: slug,
      link: `${site}${slug ? `/producto/${slug}` : "/"}?${utm}`,
      status: "pendiente",
    };
  });

  // La guía queda como borrador, con un slug que no choque con otra
  let guideSlug: string | null = null;
  if (out.guide) {
    const guides = await getGuidesFresh();
    const base = slugify(out.guide.title) || `guia-${week}`;
    let slug = base;
    for (let n = 2; guides.some((g) => g.slug === slug); n++) slug = `${base}-${n}`;
    const now = new Date().toISOString();
    const guide: Guide = {
      slug,
      title: out.guide.title.trim(),
      description: out.guide.description.trim(),
      keyword: out.guide.keyword.trim(),
      body: out.guide.body.trim(),
      productIds: out.guide.product_slugs.map((s) => idsBySlug.get(s)).filter((id): id is string => Boolean(id)),
      status: "borrador",
      week,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };
    await saveGuides([...guides, guide]);
    guideSlug = slug;
  }

  const run: MarketingRun = {
    id: `${week}-${Date.now().toString(36)}`,
    week,
    createdAt: new Date().toISOString(),
    by,
    summary: out.summary.trim(),
    actions: out.actions.slice(0, 5).map((a) => ({ title: a.title.trim(), why: a.why.trim(), how: a.how.trim(), done: false })),
    posts,
    guideSlug,
    searchConsole,
    usage,
  };
  await saveMarketingRuns([run, ...(await getMarketingRuns())]);
  await logEvent("marketing_generado", "marketing", null, { semana: week, por: by, publicaciones: posts.length, guia: guideSlug, costo_usd: usage.costUsd });
  await sendWeeklyEmail(run);
  return run;
}

async function sendWeeklyEmail(run: MarketingRun) {
  const to = (await getSettings()).contactEmail;
  if (!to) return;
  const site = siteUrl();
  const actions = run.actions.map((a) => `<li style="margin-bottom:10px"><strong>${escapeHtml(a.title)}</strong><br><span style="color:#5c4f45">${escapeHtml(a.why)}</span></li>`).join("");
  await sendEmail({
    to,
    subject: `Marketing de la semana del ${run.week}: ${run.posts.length} publicaciones${run.guideSlug ? " y una guía" : ""} para aprobar`,
    html: emailLayout(
      "Tu plan de marketing de esta semana",
      `<p>${escapeHtml(run.summary)}</p>
<p style="margin-top:20px"><strong>3 acciones para esta semana</strong></p><ol style="padding-left:20px">${actions}</ol>
<p>Además quedaron listas <strong>${run.posts.length} publicaciones de Instagram</strong>${run.guideSlug ? " y el <strong>borrador de una guía</strong> para la web" : ""}. Revísalas, cópialas y apruébalas:</p>
<p style="margin:24px 0"><a href="${site}/admin/marketing" style="background:#387b4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Abrir Marketing</a></p>`,
    ),
  });
}

/**
 * Para la tarea periódica: los lunes desde las 7:00 (hora de Chile), una vez por semana,
 * solo en producción. Devuelve true si generó el plan.
 */
export async function runWeeklyMarketing(now = new Date()) {
  if (!automationsActive() || !process.env.ANTHROPIC_API_KEY) return false;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  if (parts.weekday !== "Mon" || Number(parts.hour) < 7) return false;
  const week = weekOf(now);
  if ((await getMarketingRuns()).some((r) => r.week === week)) return false;

  // La tarea corre cada 5 minutos y el plan tarda 1 a 2: evita que dos pasadas lo generen a la vez
  const db = createAdminClient();
  const { count } = await db
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("type", "marketing_iniciado")
    .gte("created_at", new Date(now.getTime() - 20 * 60_000).toISOString());
  if (count) return false;
  await logEvent("marketing_iniciado", "marketing", null, { semana: week });
  await runMarketingAgent("Tarea semanal");
  return true;
}
