import { connection, type NextRequest } from "next/server";
import { getCatalog } from "@/lib/catalog";
import { availability, displayName, productHref, tastingNotes } from "@/lib/catalog-utils";
import { normalizeSource } from "@/lib/source";
import { siteUrl } from "@/lib/env";
import type { Product } from "@/lib/catalog-types";

/*
 * Feed de productos (RSS 2.0 con los campos de Google) para Google Merchant
 * Center (Shopping gratis) y el catálogo de Meta (tienda de Instagram y Facebook).
 * Se actualiza solo con el catálogo. Solo incluye productos con foto: Google y
 * Meta rechazan los que no tienen. `?canal=instagram` etiqueta los enlaces
 * para que Reportes muestre las ventas de ese canal (por defecto, google).
 */

const BRAND = "Kaffa Love";
// Taxonomía de Google: Alimentos, bebidas y tabaco > Bebidas > Café
const COFFEE_CATEGORY = "1868";

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function absolute(url: string, base: string) {
  return /^https?:\/\//.test(url) ? url : `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function describe(p: Product) {
  const parts: string[] = [];
  if (p.description) parts.push(p.description.trim());
  if (p.type === "cafe") {
    const notes = tastingNotes(p);
    if (notes.length) parts.push(`Notas de cata: ${notes.join(", ")}.`);
    const facts = [p.origin && `Origen: ${p.origin}`, p.process && `Proceso: ${p.process}`, p.variety && `Variedad: ${p.variety}`].filter(Boolean);
    if (facts.length) parts.push(`${facts.join(". ")}.`);
    parts.push("Café de especialidad tostado en Santiago. Bolsa de 250 g, en grano o molido a tu gusto.");
  }
  return (parts.join(" ") || displayName(p).title).slice(0, 5000);
}

export async function GET(request: NextRequest) {
  await connection();
  const canal = normalizeSource(request.nextUrl.searchParams.get("canal")) ?? "google";
  const base = siteUrl();
  const catalog = await getCatalog();

  const items = catalog.products
    .filter((p) => p.type !== "preparado" && p.image_urls.length > 0)
    .map((p) => {
      const [image, ...more] = p.image_urls.map((u) => absolute(u, base));
      const { available } = availability(p, catalog);
      const link = `${base}${productHref(p)}?utm_source=${canal}&utm_medium=catalogo`;
      return [
        "<item>",
        `<g:id>${xml(p.id)}</g:id>`,
        `<g:title>${xml(p.name.slice(0, 150))}</g:title>`,
        `<g:description>${xml(describe(p))}</g:description>`,
        `<g:link>${xml(link)}</g:link>`,
        `<g:image_link>${xml(image)}</g:image_link>`,
        ...more.slice(0, 10).map((u) => `<g:additional_image_link>${xml(u)}</g:additional_image_link>`),
        `<g:availability>${available ? "in_stock" : "out_of_stock"}</g:availability>`,
        `<g:price>${p.price_clp} CLP</g:price>`,
        `<g:brand>${BRAND}</g:brand>`,
        "<g:condition>new</g:condition>",
        "<g:identifier_exists>no</g:identifier_exists>",
        p.type === "cafe" ? `<g:google_product_category>${COFFEE_CATEGORY}</g:google_product_category>` : "",
        p.type === "promocion" ? "<g:is_bundle>yes</g:is_bundle>" : "",
        `<g:product_type>${p.type === "cafe" ? "Café de especialidad" : p.type === "promocion" ? "Promociones" : "Accesorios"}</g:product_type>`,
        "</item>",
      ]
        .filter(Boolean)
        .join("");
    });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${BRAND}</title>
<link>${base}</link>
<description>Café de especialidad y accesorios de Kaffa Love</description>
${items.join("\n")}
</channel>
</rss>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
