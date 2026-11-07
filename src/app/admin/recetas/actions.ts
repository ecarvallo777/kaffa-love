"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { slugify } from "@/lib/slug";
import { getRecipesFresh, saveRecipes, type Recipe } from "@/lib/recipes";
import type { Grind } from "@/lib/catalog-types";
import type { ActionResult } from "@/components/admin/action-form";

const GRINDS: Grind[] = ["grano", "fina", "media", "gruesa"];

export async function saveRecipe(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const id = String(form.get("id") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const method = String(form.get("method") ?? "").trim();
  const coffeeGrams = Number(String(form.get("coffeeGrams") ?? "").replace(",", "."));
  const waterMl = Number(String(form.get("waterMl") ?? "").replace(",", "."));
  const grind = String(form.get("grind")) as Grind;

  if (title.length < 3) return { error: "Ponle un título a la receta." };
  if (!(coffeeGrams > 0 && coffeeGrams <= 1000)) return { error: "Los gramos de café deben ser un número mayor que cero." };
  if (!(waterMl > 0 && waterMl <= 5000)) return { error: "Los ml de agua deben ser un número mayor que cero." };
  if (!GRINDS.includes(grind)) return { error: "Elige la molienda." };

  let steps: Recipe["steps"] = [];
  try {
    steps = (JSON.parse(String(form.get("steps") ?? "[]")) as Recipe["steps"])
      .map((s) => ({
        title: String(s.title ?? "").trim(),
        text: String(s.text ?? "").trim(),
        seconds: Math.min(Math.max(Math.round(Number(s.seconds) || 0), 0), 3600),
      }))
      .filter((s) => s.text);
  } catch {
    return { error: "No se pudieron leer los pasos." };
  }
  if (!steps.length) return { error: "Agrega al menos un paso." };
  const timedSeconds = steps.reduce((s, x) => s + x.seconds, 0);
  if (timedSeconds > 3600) return { error: "El tiempo total de los pasos no puede superar una hora." };

  const recipes = await getRecipesFresh();
  const recipe: Recipe = {
    id: id || `${slugify(title) || "receta"}-${Date.now().toString(36)}`,
    title,
    method,
    coffeeGrams,
    waterMl,
    temperature: String(form.get("temperature") ?? "").trim(),
    grind,
    totalTime: String(form.get("totalTime") ?? "").trim(),
    steps,
    notes: String(form.get("notes") ?? "").trim(),
    productIds: form.getAll("productIds").map(String),
    active: form.get("active") === "on",
    featured: form.get("featured") === "on",
    updatedAt: new Date().toISOString(),
  };

  const exists = recipes.some((r) => r.id === recipe.id);
  const next = exists ? recipes.map((r) => (r.id === recipe.id ? recipe : r)) : [...recipes, recipe];
  try {
    await saveRecipes(next);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await logEvent(exists ? "receta_editada" : "receta_creada", "recipe", null, { receta: recipe.id, titulo: title, cafes: recipe.productIds.length, por: staff.email });
  updateTag("recipes");

  if (!exists) redirect(`/admin/recetas/${recipe.id}?creada=1`);
  refresh();
  return { ok: "Receta guardada. Ya se ve en las fichas de los cafés asociados." };
}

export async function deleteRecipe(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const id = String(form.get("id") ?? "");
  const recipes = await getRecipesFresh();
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) return { error: "La receta ya no existe." };
  try {
    await saveRecipes(recipes.filter((r) => r.id !== id));
  } catch (e) {
    return { error: (e as Error).message };
  }
  await logEvent("receta_eliminada", "recipe", null, { receta: id, titulo: recipe.title, por: staff.email });
  updateTag("recipes");
  redirect("/admin/recetas");
}
