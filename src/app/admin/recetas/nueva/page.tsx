import { connection } from "next/server";
import Link from "next/link";
import { listProducts } from "@/lib/admin-data";
import { PageHeader } from "@/components/admin/ui";
import { RecipeForm } from "../recipe-form";

export const metadata = { title: "Nueva receta" };

export default async function NewRecipePage() {
  await connection();
  const coffees = (await listProducts()).filter((p) => p.type === "cafe");
  return (
    <>
      <Link href="/admin/recetas" className="text-sm text-ink-soft hover:text-ink">← Recetas</Link>
      <PageHeader title="Nueva receta" />
      <RecipeForm recipe={null} coffees={coffees.map((c) => ({ id: c.id, name: c.name, active: c.active }))} />
    </>
  );
}
