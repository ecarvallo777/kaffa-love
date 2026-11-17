import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog";
import { getPublishedGuides } from "@/lib/guides";
import { categoryHref, productHref, topCategories } from "@/lib/catalog-utils";

const base = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [catalog, guides] = await Promise.all([getCatalog(), getPublishedGuides()]);
  const url = base();
  return [
    { url, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/guias`, changeFrequency: "weekly" as const, priority: 0.6 },
    ...guides.map((g) => ({ url: `${url}/guias/${g.slug}`, lastModified: g.updatedAt, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...topCategories(catalog).map((c) => ({ url: `${url}${categoryHref(c)}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...catalog.products
      .filter((p) => p.type !== "preparado")
      .map((p) => ({ url: `${url}${productHref(p)}`, changeFrequency: "weekly" as const, priority: p.type === "cafe" ? 0.9 : 0.7 })),
    ...["/nosotros", "/contacto", "/legal/terminos", "/legal/cambios-y-devoluciones", "/legal/privacidad"].map((path) => ({
      url: `${url}${path}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
