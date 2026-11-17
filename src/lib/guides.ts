import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";

/*
 * Guías de la tienda (kaffalove.cl/guias): artículos que responden lo que la gente busca
 * en Google ("cómo preparar café en prensa francesa") y enlazan a los cafés.
 * El agente de marketing deja un borrador cada semana; nada se publica sin aprobación.
 * Se guardan en config/guias.json.
 */

const FILE = "guias.json";

export type GuideStatus = "borrador" | "publicada" | "descartada";

export type Guide = {
  slug: string;
  title: string;
  /** Descripción para Google (meta description), 140 a 160 caracteres */
  description: string;
  /** Búsqueda a la que responde */
  keyword: string;
  /** Texto en Markdown simple: ## y ### títulos, párrafos, listas con "-" o "1.", **negrita** y [enlaces](/ruta) */
  body: string;
  productIds: string[];
  status: GuideStatus;
  /** Semana del agente que la propuso (null si la escribió una persona) */
  week: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

/** Todas las guías, sin caché (administración y agente) */
export async function getGuidesFresh(): Promise<Guide[]> {
  return readConfigJson<Guide[]>(FILE, []);
}

/** Guías publicadas, de la más nueva a la más antigua (tienda, con caché) */
export async function getPublishedGuides(): Promise<Guide[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("guides");
  const all = await readConfigJson<Guide[]>(FILE, []);
  return all.filter((g) => g.status === "publicada").sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function saveGuides(guides: Guide[]) {
  await writeConfigJson(FILE, guides);
}
