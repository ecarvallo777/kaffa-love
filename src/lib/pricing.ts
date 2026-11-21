import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { getProductCosts } from "@/lib/costs";
import { getSettings, type Settings } from "@/lib/settings";
import { usageOf, type ReadUsage } from "@/lib/purchases";
import { logEvent } from "@/lib/events";

/*
 * Precio de venta sugerido: costo + estudio de mercado.
 *
 * Margen = utilidad sobre la venta sin IVA, después de la comisión de Mercado Pago:
 *   utilidad = precio / (1 + IVA) − costo − precio × comisión
 *   margen   = utilidad / (precio / (1 + IVA))
 * Claude busca el mismo producto (o uno equivalente) en tiendas chilenas con búsqueda web,
 * revisa los precios y sugiere uno atractivo frente al mercado, sin bajar del margen mínimo.
 * Cada sugerencia guarda sus referencias (tienda, precio y enlace) para ver de dónde sale.
 * Nada cambia el precio solo: se aplica con un botón en Admin → Precios.
 * Se guarda en config/precios.json.
 */

const STORE = "precios.json";
const MODEL = "claude-opus-5-5";
/** Solo accesorios: el café envasado y los preparados no se comparan con el mercado (decisión del negocio) */
export const STUDY_TYPES = ["accesorio"];
/** Bajo este margen no se sugiere un precio (cubre despacho gratis, descuentos y mermas) */
export const MIN_MARGIN = 0.25;
/** Costo de la búsqueda web de Anthropic: US$ 10 por 1.000 búsquedas */
const SEARCH_USD = 0.01;

export type PriceReference = { store: string; title: string; url: string; priceClp: number; match: "igual" | "similar" };

export type PriceStudy = {
  productId: string;
  productName: string;
  status: "pendiente" | "listo" | "error";
  requestedAt: string;
  /** Inicio del estudio en curso (evita que dos pasadas estudien lo mismo) */
  startedAt?: string;
  studiedAt?: string;
  costClp?: number;
  /** Precio que tenía el producto al estudiarlo */
  priceClp?: number;
  commissionPct?: number;
  suggestedPriceClp?: number;
  floorPriceClp?: number;
  market?: { min: number; median: number; max: number } | null;
  references?: PriceReference[];
  summary?: string;
  error?: string;
  usage?: ReadUsage & { searches: number };
  appliedAt?: string;
};

// --- Cálculo ------------------------------------------------------------------------------

/** Comisión que corresponde: los preparados se venden en feria (Point); el resto, la mayor (tienda online) */
export function commissionFor(type: string, s: Pick<Settings, "mpFeriaPct" | "mpTiendaPct">) {
  return type === "preparado" ? s.mpFeriaPct : Math.max(s.mpTiendaPct, s.mpFeriaPct);
}

export function marginAt(priceClp: number, costClp: number, ivaPct: number, commissionPct: number) {
  const net = priceClp / (1 + ivaPct / 100);
  if (net <= 0) return null;
  return (net - costClp - priceClp * (commissionPct / 100)) / net;
}

/** Precio con IVA que deja exactamente ese margen */
export function priceForMargin(costClp: number, margin: number, ivaPct: number, commissionPct: number) {
  const k = (1 - margin) / (1 + ivaPct / 100) - commissionPct / 100;
  return k > 0 ? costClp / k : Infinity;
}

/** Redondea hacia arriba a un precio "de tienda": termina en 90 (bajo $10.000) o en 990 */
export function roundPrice(p: number) {
  if (!Number.isFinite(p)) return p;
  if (p < 10_000) return Math.ceil((p + 10) / 100) * 100 - 10;
  return Math.ceil((p + 10) / 1000) * 1000 - 10;
}

// --- Almacenamiento -------------------------------------------------------------------------

export async function getPriceStudies(): Promise<Record<string, PriceStudy>> {
  return readConfigJson<Record<string, PriceStudy>>(STORE, {});
}

async function updateStudy(productId: string, change: (s: PriceStudy | undefined) => PriceStudy) {
  const all = await getPriceStudies();
  all[productId] = change(all[productId]);
  await writeConfigJson(STORE, all);
  return all[productId];
}

/** Deja productos en cola para estudiar (la tarea periódica los estudia de a uno) */
export async function queuePriceStudies(products: { id: string; name: string }[]) {
  if (!products.length) return 0;
  const all = await getPriceStudies();
  const now = new Date().toISOString();
  for (const p of products) {
    if (all[p.id]?.status === "pendiente") continue;
    all[p.id] = { ...(all[p.id] ?? {}), productId: p.id, productName: p.name, status: "pendiente", requestedAt: now };
  }
  await writeConfigJson(STORE, all);
  return products.length;
}

export async function markPriceApplied(productId: string) {
  await updateStudy(productId, (s) => ({ ...(s as PriceStudy), appliedAt: new Date().toISOString() }));
}

// --- Estudio de mercado con Claude --------------------------------------------------------------

const ReferenceSchema = z.object({
  store: z.string(),
  title: z.string(),
  url: z.string().url(),
  price_clp: z.number().int().positive(),
  match: z.enum(["igual", "similar"]),
});
const StudySchema = z.object({
  references: z.array(ReferenceSchema).max(8),
  suggested_price_clp: z.number().int().positive(),
  summary: z.string(),
});

const SYSTEM = `Eres analista de precios de Kaffa Love, una tienda chilena de café de especialidad y accesorios para prepararlo (kaffalove.cl), que vende online y en ferias.
Tu tarea: estudiar el mercado chileno de un producto y sugerir su precio de venta.

Cómo investigar:
- Busca el mismo producto o uno equivalente (misma función, capacidad, material y calidad parecida) en tiendas que venden en Chile: tiendas de café de especialidad, Mercado Libre Chile, Falabella, Paris, Ripley, Lider, tiendas de cocina y tiendas de accesorios de café.
- Usa precios en pesos chilenos con IVA, de ofertas vigentes. Si un precio viene solo del resumen de la búsqueda y no estás seguro, abre la página para confirmarlo.
- Junta entre 3 y 6 referencias. No inventes enlaces ni precios: cada referencia debe venir de una página que encontraste. Marca "igual" si es el mismo producto y "similar" si es equivalente.

Cómo sugerir el precio:
- Debe ser atractivo frente al mercado: si el producto es igual al de la competencia, cerca o algo bajo la mediana; si es de mejor calidad o es especialidad, puede ir en la mediana o sobre ella. Si los productos de bajo costo dan para ganar más, aprovéchalo sin salirte del mercado.
- Nunca bajo el precio mínimo que se te indica (margen mínimo). Si el mercado está bajo ese mínimo, sugiere el mínimo y dilo.
- Usa precios terminados en 90 bajo $10.000 (ej. 6.990, 4.490) y en 990 desde $10.000 (ej. 12.990).

Responde al final SOLO con un objeto JSON, sin texto antes ni después, con esta forma:
{"references":[{"store":"…","title":"…","url":"https://…","price_clp":12990,"match":"igual"}],"suggested_price_clp":12990,"summary":"2 a 4 frases en español: rango de mercado, cómo se compara el producto y por qué ese precio."}`;

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(raw);
}

/** Investiga el mercado y sugiere precio para un producto (existente o nuevo de una factura) */
export async function studyMarket(input: { name: string; type: string; description?: string | null; costClp: number; currentPriceClp?: number | null }) {
  const settings = await getSettings();
  const commission = commissionFor(input.type, settings);
  const floor = roundPrice(priceForMargin(input.costClp, MIN_MARGIN, settings.ivaPct, commission));
  const table = [0.25, 0.35, 0.45, 0.55, 0.65].map((m) => `margen ${Math.round(m * 100)} % → ${Math.round(priceForMargin(input.costClp, m, settings.ivaPct, commission))}`);

  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Producto: ${input.name}
Tipo: ${input.type === "cafe" ? "café de especialidad en grano o molido (bolsa de 250 g)" : input.type === "preparado" ? "bebida preparada que se vende en ferias" : "accesorio para preparar o servir café"}
${input.description ? `Descripción: ${input.description.slice(0, 600)}\n` : ""}Costo neto (sin IVA): $${input.costClp}
Precio actual: ${input.currentPriceClp ? `$${input.currentPriceClp}` : "sin precio aún"}
IVA ${settings.ivaPct} %, comisión de Mercado Pago ${commission} %.
Precio mínimo (margen ${Math.round(MIN_MARGIN * 100)} %): $${floor}
Precio con IVA para cada margen: ${table.join(" · ")}

Investiga el mercado chileno y sugiere el precio.`,
    },
  ];

  let usageTotal = { model: MODEL, inputTokens: 0, outputTokens: 0, costUsd: 0 as number | null, fallback: false, searches: 0 };
  let final: Anthropic.Beta.BetaMessage | null = null;
  for (let turn = 0; turn < 5; turn++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 8, user_location: { type: "approximate", country: "CL", city: "Santiago", timezone: "America/Santiago" } },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
      ],
      messages,
    });
    const u = usageOf(response);
    const searches = response.usage.server_tool_use?.web_search_requests ?? 0;
    usageTotal = {
      model: u.model,
      inputTokens: usageTotal.inputTokens + u.inputTokens,
      outputTokens: usageTotal.outputTokens + u.outputTokens,
      costUsd: usageTotal.costUsd === null || u.costUsd === null ? null : usageTotal.costUsd + u.costUsd + searches * SEARCH_USD,
      fallback: usageTotal.fallback || u.fallback,
      searches: usageTotal.searches + searches,
    };
    // Una búsqueda larga puede pausar el turno: se reenvía para que siga
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    final = response;
    break;
  }
  if (usageTotal.costUsd !== null) usageTotal.costUsd = Math.round(usageTotal.costUsd * 10000) / 10000;
  if (!final) throw Object.assign(new Error("La búsqueda no terminó a tiempo."), { usage: usageTotal });
  if (final.stop_reason === "refusal") throw Object.assign(new Error("Claude no pudo estudiar este producto."), { usage: usageTotal });

  const text = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
  let parsed: z.infer<typeof StudySchema>;
  try {
    parsed = StudySchema.parse(extractJson(text));
  } catch {
    throw Object.assign(new Error("No se pudo leer el resultado del estudio."), { usage: usageTotal });
  }

  const prices = parsed.references.map((r) => r.price_clp).sort((a, b) => a - b);
  const median = prices.length ? (prices.length % 2 ? prices[(prices.length - 1) / 2] : Math.round((prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2)) : null;
  return {
    suggestedPriceClp: Math.max(parsed.suggested_price_clp, floor),
    floorPriceClp: floor,
    commissionPct: commission,
    market: median === null ? null : { min: prices[0], median, max: prices[prices.length - 1] },
    references: parsed.references.map((r): PriceReference => ({ store: r.store, title: r.title, url: r.url, priceClp: r.price_clp, match: r.match })),
    summary: parsed.summary,
    usage: usageTotal,
  };
}

/** Estudia un producto del catálogo y guarda el resultado */
export async function studyProduct(productId: string) {
  const db = createAdminClient();
  const [{ data: p, error }, costs] = await Promise.all([
    db.from("products").select("id, name, type, description, price_clp").eq("id", productId).single(),
    getProductCosts(),
  ]);
  if (error || !p) throw new Error("No se encontró el producto.");
  if (!STUDY_TYPES.includes(p.type)) throw new Error("Solo se estudia el precio de los accesorios.");
  const cost = costs[productId];
  const base = { productId, productName: p.name, requestedAt: new Date().toISOString() };
  if (cost === undefined) {
    return updateStudy(productId, (s) => ({ ...s, ...base, status: "error", error: "Falta el costo del producto (ingrésalo en Productos o con una factura).", studiedAt: new Date().toISOString() }));
  }
  try {
    const r = await studyMarket({ name: p.name, type: p.type, description: p.description, costClp: cost, currentPriceClp: p.price_clp });
    const study = await updateStudy(productId, (s) => ({
      ...base,
      startedAt: undefined,
      requestedAt: s?.requestedAt ?? base.requestedAt,
      status: "listo",
      studiedAt: new Date().toISOString(),
      costClp: cost,
      priceClp: p.price_clp,
      ...r,
    }));
    await logEvent("precio_estudiado", "product", productId, { producto: p.name, actual: p.price_clp, sugerido: r.suggestedPriceClp, referencias: r.references.length, costo_usd: r.usage.costUsd });
    return study;
  } catch (e) {
    const usage = (e as { usage?: PriceStudy["usage"] }).usage;
    return updateStudy(productId, (s) => ({ ...s, ...base, startedAt: undefined, status: "error", error: (e as Error).message, studiedAt: new Date().toISOString(), ...(usage && { usage }) }));
  }
}

/** Tarea periódica: estudia el producto pendiente más antiguo */
export async function studyNextPendingPrice() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const busy = (s: PriceStudy) => s.startedAt && Date.now() - new Date(s.startedAt).getTime() < 6 * 60_000;
  const pending = Object.values(await getPriceStudies())
    .filter((s) => s.status === "pendiente" && !busy(s))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  if (!pending.length) return null;
  await updateStudy(pending[0].productId, (s) => ({ ...(s as PriceStudy), startedAt: new Date().toISOString() }));
  const s = await studyProduct(pending[0].productId);
  return { product: s.productName, status: s.status, waiting: pending.length - 1 };
}
