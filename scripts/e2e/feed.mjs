// Prueba del feed de productos para Google Merchant Center y Meta.
// Pone una foto temporal a un café (y la quita al final) para comprobar que
// aparece con precio, disponibilidad y enlace etiquetado. Requiere `npm run dev`.
import { BASE, assert, sleep, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();
const { data: product } = await db.from("products").select("id, slug, price_clp, image_urls").eq("slug", "caicedo-blend-colombia").single();
const original = product.image_urls;
const photo = "https://kaffalove.cl/e2e-foto-de-prueba.jpg";

async function feed(qs = "") {
  const res = await fetch(`${BASE}/feed/productos.xml${qs}`);
  return { status: res.status, type: res.headers.get("content-type"), text: await res.text() };
}

try {
  step("El feed responde XML válido");
  let f = await feed();
  assert(f.status === 200 && f.type.includes("xml"), `responde ${f.status} ${f.type}`);
  assert(f.text.startsWith("<?xml") && f.text.includes('xmlns:g="http://base.google.com/ns/1.0"'), "RSS con campos de Google");
  const skipped = !original?.length;
  if (skipped) assert(!f.text.includes(`<g:id>${product.id}</g:id>`), "sin foto, el producto no se incluye");

  step("Con foto, el café aparece completo");
  if (skipped) await db.from("products").update({ image_urls: [photo] }).eq("id", product.id);
  let item = null;
  for (let i = 0; i < 40 && !item; i++) {
    f = await feed("?canal=instagram");
    item = new RegExp(`<item><g:id>${product.id}</g:id>.*?</item>`).exec(f.text)?.[0] ?? null;
    if (!item) await sleep(5000); // el catálogo está en caché por minutos
  }
  assert(!!item, "el café aparece en el feed");
  assert(item.includes(`<g:price>${product.price_clp} CLP</g:price>`), `precio ${product.price_clp} CLP`);
  assert(/<g:availability>(in_stock|out_of_stock)<\/g:availability>/.test(item), "con disponibilidad");
  assert(item.includes(`/producto/${product.slug}?utm_source=instagram&amp;utm_medium=catalogo`), "enlace etiquetado con el canal");
  assert(item.includes("<g:google_product_category>1868</g:google_product_category>"), "categoría Café de Google");
  assert(item.includes("<g:brand>Kaffa Love</g:brand>"), "con marca");
  assert(!f.text.includes("Preparado"), "no incluye bebidas preparadas de feria");

  console.log("\nTodo OK");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await db.from("products").update({ image_urls: original ?? [] }).eq("id", product.id);
  const { data } = await db.from("products").select("image_urls").eq("id", product.id).single();
  console.log(`(foto temporal quitada: ${JSON.stringify(data.image_urls) === JSON.stringify(original ?? [])})`);
}
