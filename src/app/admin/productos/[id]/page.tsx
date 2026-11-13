import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCategories, listProducts } from "@/lib/admin-data";
import { getProductCosts } from "@/lib/costs";
import { getSettings } from "@/lib/settings";import { PageHeader } from "@/components/admin/ui";
import { ProductForm, type ProductRow } from "../product-form";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({ params, searchParams }: PageProps<"/admin/productos/[id]">) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: product }, { data: bundle }, categories, products, costs, settings] = await Promise.all([
    db.from("products").select("*").eq("id", id).maybeSingle(),
    db.from("bundle_items").select("product_id, quantity").eq("bundle_id", id),
    listCategories(),
    listProducts(),
    getProductCosts(),
    getSettings(),
  ]);
  if (!product) notFound();

  return (
    <>
      <Link href="/admin/productos" className="text-sm text-ink-soft hover:text-ink">← Productos</Link>
      <PageHeader
        title={product.name}
        description={sp.creado ? "Producto creado. Puedes seguir editándolo." : undefined}
        actions={product.visible_online && product.active ? <Link href={`/producto/${product.slug}`} className="text-sm text-ink-soft hover:text-ink" target="_blank">Ver en la tienda ↗</Link> : null}
      />
      <ProductForm
        product={product as ProductRow}
        categories={categories}
        options={products}
        bundle={bundle ?? []}
        cost={costs[product.id] ?? null}
        costs={costs}
        ivaPct={settings.ivaPct}
      />
    </>
  );
}
