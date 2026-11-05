import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { Catalog } from "@/lib/catalog-types";

/**
 * Todo el catálogo visible online en una sola lectura (es pequeño).
 * Se guarda en caché y se renueva cada minuto; el stock definitivo se
 * vuelve a comprobar al pagar, así que unos segundos de desfase no venden
 * de más. Para refrescarlo al instante: revalidateTag("catalog").
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog");

  const db = createPublicClient();
  const [categories, products, bundleItems] = await Promise.all([
    db.from("categories").select("id, name, slug, parent_id, sort_order").order("sort_order"),
    db
      .from("products")
      .select(
        "id, name, slug, type, category_id, description, origin, process, variety, tasting_notes, price_clp, track_stock, stock, low_stock_threshold, image_urls",
      )
      .order("name"),
    db.from("bundle_items").select("bundle_id, product_id, quantity"),
  ]);

  const error = categories.error ?? products.error ?? bundleItems.error;
  if (error) throw new Error(`No se pudo leer el catálogo: ${error.message}`);

  return {
    categories: categories.data ?? [],
    products: products.data ?? [],
    bundleItems: bundleItems.data ?? [],
  };
}
