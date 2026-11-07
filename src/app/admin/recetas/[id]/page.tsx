import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listProducts } from "@/lib/admin-data";
import { getRecipesFresh } from "@/lib/recipes";
import { PageHeader } from "@/components/admin/ui";
import { RecipeForm } from "../recipe-form";

export const metadata = { title: "Editar receta" };

export default async function EditRecipePage({ params, searchParams }: PageProps<"/admin/recetas/[id]">) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  const [recipes, products] = await Promise.all([getRecipesFresh(), listProducts()]);
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) notFound();
  const coffees = products.filter((p) => p.type === "cafe");

  return (
    <>
      <Link href="/admin/recetas" className="text-sm text-ink-soft hover:text-ink">← Recetas</Link>
      <PageHeader title={recipe.title} description={sp.creada ? "Receta creada. Puedes seguir editándola." : undefined} />
      <RecipeForm recipe={recipe} coffees={coffees.map((c) => ({ id: c.id, name: c.name, active: c.active }))} />
    </>
  );
}
