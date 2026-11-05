import type { Catalog, Category, Product } from "@/lib/catalog-types";

const clpFormat = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export const clp = (n: number) => clpFormat.format(n);

export const productHref = (p: Pick<Product, "slug">) => `/producto/${p.slug}`;
export const categoryHref = (c: Pick<Category, "slug">) => `/categoria/${c.slug}`;

/** "Caicedo Blend, Colombia" → { title: "Caicedo Blend", subtitle: "Colombia" } */
export function displayName(p: Product) {
  if (p.type === "cafe") {
    const i = p.name.lastIndexOf(", ");
    if (i > 0) return { title: p.name.slice(0, i), subtitle: p.name.slice(i + 2) };
  }
  return { title: p.name, subtitle: null as string | null };
}

export function tastingNotes(p: Product): string[] {
  if (!p.tasting_notes) return [];
  return p.tasting_notes
    .split(/[,;|·]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function bundleDetails(p: Product, catalog: Catalog) {
  const items = catalog.bundleItems
    .filter((b) => b.bundle_id === p.id)
    .map((b) => ({
      product: catalog.products.find((x) => x.id === b.product_id),
      quantity: b.quantity,
    }))
    .filter((x): x is { product: Product; quantity: number } => !!x.product);
  const regular = items.reduce((s, x) => s + x.product.price_clp * x.quantity, 0);
  return { items, regular, savings: Math.max(0, regular - p.price_clp) };
}

/**
 * Disponibilidad para la tienda. Una promoción está disponible solo si todos
 * sus productos tienen stock; su máximo es el del producto más escaso.
 */
export function availability(p: Product, catalog: Catalog) {
  let maxQty: number | null;
  let threshold = p.low_stock_threshold;

  if (p.type === "promocion") {
    const { items } = bundleDetails(p, catalog);
    const tracked = items.filter((x) => x.product.track_stock);
    maxQty = tracked.length
      ? Math.min(...tracked.map((x) => Math.floor(x.product.stock / x.quantity)))
      : null;
    threshold = Math.min(...items.map((x) => x.product.low_stock_threshold), 3);
    if (items.length === 0) maxQty = 0;
  } else {
    maxQty = p.track_stock ? p.stock : null;
  }

  const available = maxQty === null || maxQty > 0;
  const low = available && maxQty !== null && maxQty <= threshold;
  return { available, maxQty, low };
}

export function categoryById(catalog: Catalog, id: string | null) {
  return catalog.categories.find((c) => c.id === id) ?? null;
}

/** La categoría y todas sus subcategorías */
function categoryTree(catalog: Catalog, root: Category): string[] {
  const kids = catalog.categories.filter((c) => c.parent_id === root.id);
  return [root.id, ...kids.flatMap((k) => categoryTree(catalog, k))];
}

export function productsInCategory(catalog: Catalog, category: Category) {
  const ids = new Set(categoryTree(catalog, category));
  return catalog.products.filter((p) => p.category_id && ids.has(p.category_id));
}

/** Categorías principales que tienen algo para vender online */
export function topCategories(catalog: Catalog) {
  return catalog.categories.filter(
    (c) => !c.parent_id && productsInCategory(catalog, c).length > 0,
  );
}

export function subcategories(catalog: Catalog, category: Category) {
  return catalog.categories.filter(
    (c) => c.parent_id === category.id && productsInCategory(catalog, c).length > 0,
  );
}

/** Disponibles primero; dentro de eso, el orden que trae el catálogo */
export function sortForShop(products: Product[], catalog: Catalog) {
  return [...products].sort(
    (a, b) =>
      Number(availability(b, catalog).available) - Number(availability(a, catalog).available),
  );
}
