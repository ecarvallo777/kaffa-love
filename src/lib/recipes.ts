import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Grind } from "@/lib/catalog-types";

/*
 * Recetas de preparación, editables desde la administración y asociadas a
 * uno o varios cafés. Se guardan como JSON privado en Supabase Storage
 * (config/recetas.json), igual que la configuración de la tienda.
 */

/** seconds: duración del paso para el temporizador (0 = paso de preparación previa) */
export type RecipeStep = { title: string; text: string; seconds: number };

export type Recipe = {
  id: string;
  title: string; // Ej.: "Filtrado en V60"
  method: string; // Ej.: "V60", "Chemex", "Prensa francesa"
  coffeeGrams: number;
  waterMl: number;
  temperature: string; // Ej.: "92–94 °C"
  grind: Grind;
  totalTime: string; // Ej.: "2:30 a 3:00 min"
  steps: RecipeStep[];
  notes: string;
  productIds: string[];
  active: boolean;
  /** Se muestra primero en la ficha del café */
  featured: boolean;
  updatedAt: string;
};

const BUCKET = "config";
const FILE = "recetas.json";

/** Proporción café:agua, por ejemplo 15 g y 250 ml → "1:16,7" */
export function recipeRatio(r: Pick<Recipe, "coffeeGrams" | "waterMl">) {
  if (!r.coffeeGrams) return "—";
  const n = Math.round((r.waterMl / r.coffeeGrams) * 10) / 10;
  return `1:${n.toLocaleString("es-CL")}`;
}

/** Receta inicial (la que mostraba la tienda), asociada a los cafés existentes */
async function defaultRecipes(): Promise<Recipe[]> {
  const { data } = await createAdminClient().from("products").select("id").eq("type", "cafe");
  return [
    {
      id: "filtrado-v60",
      title: "Filtrado en V60 o Chemex",
      method: "V60 / Chemex",
      coffeeGrams: 15,
      waterMl: 250,
      temperature: "92–94 °C",
      grind: "media",
      totalTime: "2:30 a 3:00 min",
      steps: [
        { title: "Muele", text: "15 g de café en molienda media.", seconds: 0 },
        { title: "Calienta", text: "250 ml de agua a 92–94 °C, recién hervida y reposada 30 segundos.", seconds: 0 },
        { title: "Pre-infusión", text: "Vierte 30 ml y espera a que el café “florezca”.", seconds: 30 },
        { title: "Vierte", text: "El resto del agua en círculos lentos, sin mojar las paredes del filtro.", seconds: 150 },
      ],
      notes: "",
      productIds: (data ?? []).map((p) => p.id),
      active: true,
      featured: true,
      updatedAt: new Date(0).toISOString(),
    },
  ];
}

async function readFile(): Promise<Recipe[] | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(FILE);
  if (error || !data) return null;
  try {
    return (JSON.parse(await data.text()) as Partial<Recipe>[]).map(normalize);
  } catch {
    return null;
  }
}

/** Completa campos que no existían en versiones anteriores del archivo */
function normalize(r: Partial<Recipe>): Recipe {
  return {
    id: r.id ?? "",
    title: r.title ?? "",
    method: r.method ?? "",
    coffeeGrams: r.coffeeGrams ?? 0,
    waterMl: r.waterMl ?? 0,
    temperature: r.temperature ?? "",
    grind: r.grind ?? "media",
    totalTime: r.totalTime ?? "",
    steps: (r.steps ?? []).map((s) => ({ title: s.title ?? "", text: s.text ?? "", seconds: Number(s.seconds) || 0 })),
    notes: r.notes ?? "",
    productIds: r.productIds ?? [],
    active: r.active ?? true,
    featured: r.featured ?? false,
    updatedAt: r.updatedAt ?? new Date(0).toISOString(),
  };
}

/** Todas las recetas (para la tienda, con caché) */
export async function getRecipes(): Promise<Recipe[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("recipes");
  return (await readFile()) ?? (await defaultRecipes());
}

/** Todas las recetas, sin caché (para la administración) */
export async function getRecipesFresh(): Promise<Recipe[]> {
  return (await readFile()) ?? (await defaultRecipes());
}

export async function saveRecipes(recipes: Recipe[]) {
  const db = createAdminClient();
  const body = new Blob([JSON.stringify(recipes, null, 2)], { type: "application/json" });
  let { error } = await db.storage.from(BUCKET).upload(FILE, body, { upsert: true });
  if (error && /not found/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: false });
    ({ error } = await db.storage.from(BUCKET).upload(FILE, body, { upsert: true }));
  }
  if (error) throw new Error(`No se pudieron guardar las recetas: ${error.message}`);
}

/** Recetas activas de un café; la destacada primero */
export async function recipesForProduct(productId: string) {
  return (await getRecipes())
    .filter((r) => r.active && r.productIds.includes(productId))
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title, "es"));
}

/** Duración total del temporizador (suma de los pasos con tiempo) */
export const timerSeconds = (r: Pick<Recipe, "steps">) => r.steps.reduce((s, x) => s + (x.seconds || 0), 0);
