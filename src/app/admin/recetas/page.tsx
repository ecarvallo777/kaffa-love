import { connection } from "next/server";
import Link from "next/link";
import { getRecipesFresh, recipeRatio } from "@/lib/recipes";
import { listProducts } from "@/lib/admin-data";
import { grindLabel } from "@/lib/grinds";
import { Empty, LinkButton, PageHeader, Pill, Table } from "@/components/admin/ui";

export const metadata = { title: "Recetas" };

export default async function RecipesPage() {
  await connection();
  const [recipes, products] = await Promise.all([getRecipesFresh(), listProducts()]);
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "Café eliminado";

  return (
    <>
      <PageHeader
        title="Recetas"
        description="Recetas de preparación que aparecen en la ficha de cada café. Una receta puede asociarse a varios cafés."
        actions={<LinkButton href="/admin/recetas/nueva" variant="primary">Nueva receta</LinkButton>}
      />
      {recipes.length ? (
        <Table>
          <thead>
            <tr>
              <th>Receta</th>
              <th>Medidas</th>
              <th>Molienda</th>
              <th>Cafés</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/recetas/${r.id}`} className="font-medium underline-offset-4 hover:underline">{r.title}</Link>
                  {r.method && <span className="block text-xs text-ink-mute">{r.method}</span>}
                </td>
                <td className="whitespace-nowrap text-ink-soft tabular-nums">
                  {r.coffeeGrams} g · {r.waterMl} ml · {recipeRatio(r)}
                </td>
                <td className="text-ink-soft">{grindLabel(r.grind)}</td>
                <td className="text-ink-soft">
                  {r.productIds.length ? r.productIds.map(nameOf).join(", ") : <span className="text-ink-mute">Sin cafés asociados</span>}
                </td>
                <td className="space-x-1">{r.active ? <Pill tone="ok">Visible</Pill> : <Pill>Oculta</Pill>}{r.featured && <Pill tone="wait">Destacada</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aún no hay recetas.</Empty>
      )}
    </>
  );
}
