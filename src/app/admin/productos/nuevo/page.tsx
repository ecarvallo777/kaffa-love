import { connection } from "next/server";
import Link from "next/link";
import { listCategories, listProducts } from "@/lib/admin-data";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "../product-form";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  await connection();
  const [categories, products] = await Promise.all([listCategories(), listProducts()]);
  return (
    <>
      <Link href="/admin/productos" className="text-sm text-ink-soft hover:text-ink">← Productos</Link>
      <PageHeader title="Nuevo producto" />
      <ProductForm product={null} categories={categories} options={products} bundle={[]} />
    </>
  );
}
