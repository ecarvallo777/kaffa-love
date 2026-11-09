// Prueba de tarifas de despacho por tamaño (Blue Express): XS para 1 bolsa
// de café, S para el resto; por región (Santiago, centro, extremo). El checkout
// muestra la tarifa y el servidor cobra la misma. Requiere `npm run dev` con pago simulado.
// Después: node scripts/e2e/limpiar.mjs
import fs from "node:fs";
import { BASE, assert, clickText, launch, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());
const clp = (n) => `$${n.toLocaleString("es-CL")}`;

async function settingsRates() {
  const { data } = await db.storage.from("config").download("settings.json");
  return Object.fromEntries(JSON.parse(await data.text()).shippingRates.map((r) => [r.region, r]));
}

async function shippingShown(region, commune = "") {
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await clickText(page, 'button[role="radio"]', "Despacho a domicilio");
  await page.select('select[autocomplete="address-level1"]', region);
  const c = await page.$('input[autocomplete="address-level2"]');
  await c.evaluate((el) => (el.value = ""));
  if (commune) await c.type(commune);
  await page.waitForFunction(() => document.body.innerText.includes("Despacho con Blue Express"), { timeout: 10000 });
  return page.evaluate(() => {
    const p = [...document.querySelectorAll("p")].find((x) => x.innerText.includes("Despacho con Blue Express"));
    return p.innerText;
  });
}

try {
  step("Guardar la configuración (refresca la caché de tarifas)");
  const email = "e2e-admin@kaffalove.test";
  const pass = /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${email}.txt`, "utf8"))[1].trim();
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  await page.goto(`${BASE}/admin/configuracion`, { waitUntil: "networkidle0" });
  await clickText(page, "button", "Guardar configuración");
  await page.waitForFunction(() => document.body.innerText.includes("Configuración guardada"), { timeout: 30000 });
  const rates = await settingsRates();
  const rm = rates["Metropolitana de Santiago"];
  const ant = rates["Antofagasta"];
  assert(rm.priceXsClp && rm.priceClp, `tarifas RM XS ${clp(rm.priceXsClp)} / S ${clp(rm.priceClp)}`);
  // Sin sesión de administrador para comprar como cliente
  const ctx = browser.defaultBrowserContext();
  await ctx.deleteCookie(...(await ctx.cookies()));

  step("1 bolsa de café → XS");
  await page.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  await clickText(page, "#molienda label", "Media");
  await clickText(page, "button", "Agregar al carrito");
  await page.waitForSelector('[role="status"]');
  let t = await shippingShown("Metropolitana de Santiago");
  assert(t.includes(clp(rm.priceXsClp)), `Santiago: ${clp(rm.priceXsClp)}`);
  t = await shippingShown("Antofagasta");
  assert(t.includes(clp(ant.priceXsClp)), `Antofagasta: ${clp(ant.priceXsClp)}`);

  step("Comuna con tarifa propia: Chaitén (Los Lagos) es zona Extremo; Castro sigue en Centro");
  t = await shippingShown("Los Lagos", "chaiten");
  assert(t.includes(clp(5200)), "Chaitén (escrito sin tilde): $5.200");
  t = await shippingShown("Los Lagos", "Castro");
  assert(t.includes(clp(rates["Los Lagos"].priceXsClp)), `Castro: ${clp(rates["Los Lagos"].priceXsClp)}`);

  step("2 bolsas → S");
  await page.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  await page.click('button[aria-label^="Agregar uno de"]');
  t = await shippingShown("Metropolitana de Santiago");
  assert(t.includes(clp(rm.priceClp)), `2 bolsas: ${clp(rm.priceClp)}`);

  step("1 café + 1 accesorio → S, y el servidor cobra lo mismo");
  await page.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  await page.click('button[aria-label^="Quitar uno de"]');
  // Accesorio barato (sin pasar el monto de despacho gratis)
  const { data: acc } = await db.from("products").select("slug").eq("type", "accesorio").eq("active", true).eq("visible_online", true).gt("stock", 0).order("price_clp").limit(1).single();
  await page.goto(`${BASE}/producto/${acc.slug}`, { waitUntil: "networkidle0" });
  await clickText(page, "button", "Agregar al carrito");
  await page.waitForSelector('[role="status"]');
  t = await shippingShown("Metropolitana de Santiago");
  assert(t.includes(clp(rm.priceClp)), `con accesorio: ${clp(rm.priceClp)}`);
  await page.type('input[type="email"]', "prueba+envio@kaffalove.test");
  await page.type('input[autocomplete="name"]', "Prueba Envío");
  await page.type('input[type="tel"]', "+56 9 8765 4321");
  await page.type('input[autocomplete="address-level2"]', "Providencia");
  await page.type('input[autocomplete="address-line1"]', "Av. Prueba");
  await page.type('input[inputmode="numeric"]', "1234");
  await clickText(page, "button", "Pagar");
  await page.waitForFunction(() => location.pathname.startsWith("/dev/pago-simulado/"), { timeout: 30000 });
  const orderId = page.url().split("/").pop().split("?")[0];
  const { data: order } = await db.from("orders").select("shipping_clp, subtotal_clp").eq("id", orderId).single();
  const expected = order.subtotal_clp >= 50000 ? 0 : rm.priceClp;
  assert(order.shipping_clp === expected, `el pedido cobra despacho ${clp(order.shipping_clp)}`);

  console.log("\nOK");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
