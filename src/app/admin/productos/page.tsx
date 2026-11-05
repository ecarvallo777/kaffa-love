import { connection } from "next/server";
import Link from "next/link";
import { clp } from "@/lib/catalog-utils";
import { listCategories, listProducts } from "@/lib/admin-data";
import { LinkButton, PageHeader, Pill, Table } from "@/components/admin/ui";

export const metadata = { title: "Productos" };

const TYPE_LABEL: Record<string, string> = { cafe: "Café", accesorio: "Accesorio", promocion: "Promoción", preparado: "Preparado (feria)" };

export default async function ProductsPage({ searchParams }: PageProps<"/admin/productos">) {
  await connection();
  const sp = await searchParams;
  const type = typeof sp.tipo === "string" ? sp.tipo : "";
  const [products, categories] = await Promise.all([listProducts(), listCategories()]);
  const shown = type ? products.filter((p) => p.type === type) : products;

  return (
    <>
      <PageHeader
        title="Productos"
        description="Todo lo que se vende online y en ferias. Los cambios se ven en la tienda en menos de un minuto."
        actions={<LinkButton href="/admin/productos/nuevo" variant="primary">Nuevo producto</LinkButton>}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {[["", "Todos"], ...Object.entries(TYPE_LABEL)].map(([k, label]) => (
          <Link key={k} href={k ? `/admin/productos?tipo=${k}` : "/admin/productos"} className={`rounded-full border px-3 py-1.5 text-sm ${type === k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {label}
          </Link>
        ))}
      </div>
      <Table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>Tipo</th>
            <th>Categoría</th>
            <th className="text-right">Precio</th>
            <th className="text-right">Stock</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className={p.active ? "" : "opacity-50"}>
              <td>
                <Link href={`/admin/productos/${p.id}`} className="font-medium underline-offset-4 hover:underline">{p.name}</Link>
              </td>
              <td className="text-ink-soft">{TYPE_LABEL[p.type]}</td>
              <td className="text-ink-soft">{categories.find((c) => c.id === p.category_id)?.name ?? "—"}</td>
              <td className="text-right tabular-nums">{clp(p.price_clp)}</td>
              <td className="text-right tabular-nums">
                {p.type === "promocion" ? <span className="text-ink-mute">según productos</span> : !p.track_stock ? <span className="text-ink-mute">sin control</span> : (
                  <span className={p.stock <= p.low_stock_threshold ? "font-medium text-accent-deep" : ""}>{p.stock}</span>
                )}
              </td>
              <td className="space-x-1">
                {!p.active ? <Pill>Inactivo</Pill> : p.visible_online ? <Pill tone="ok">En la tienda</Pill> : <Pill tone="info">Solo feria</Pill>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}
