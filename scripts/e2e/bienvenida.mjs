// Prueba del descuento de bienvenida del QR de feria: quien llega con
// ?utm_source=feria ve el aviso, el checkout descuenta el % en su primera compra
// online y el servidor cobra lo mismo; un correo que ya compró paga precio normal.
// Requiere `npm run dev` con pago simulado. Después: node scripts/e2e/limpiar.mjs
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());
const clp = (n) => `$${n.toLocaleString("es-CL")}`;
const email = `prueba+bienvenida${Date.now()}@kaffalove.test`;

async function buyViaQr(p) {
  await p.goto(`${BASE}/?utm_source=feria&utm_medium=qr`, { waitUntil: "networkidle0" });
  await p.evaluate(() => localStorage.removeItem("kaffa-cart-v1"));
  await p.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  await clickText(p, "#molienda label", "Media");
  await clickText(p, "button", "Agregar al carrito");
  await p.waitForSelector('[role="status"]');
  await p.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await p.type('input[type="email"]', email);
  await p.type('input[autocomplete="name"]', "Prueba Bienvenida");
  await p.type('input[type="tel"]', "+56 9 8765 4321");
}

async function placeAndGetOrder(p) {
  await clickText(p, "button", "Pagar");
  await p.waitForFunction(() => location.pathname.startsWith("/dev/pago-simulado/") || document.querySelector('[role="alert"]'), { timeout: 30000 });
  if (!p.url().includes("/dev/pago-simulado/")) return null;
  const id = p.url().split("/").pop().split("?")[0];
  const { data } = await db.from("orders").select("id, subtotal_clp, total_clp, order_items(unit_price_clp, quantity)").eq("id", id).single();
  return data;
}

try {
  step("Guardar la configuración (refresca la caché)");
  const admin = "e2e-admin@kaffalove.test";
  const pass = /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${admin}.txt`, "utf8"))[1].trim();
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', admin);
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  await page.goto(`${BASE}/admin/configuracion`, { waitUntil: "networkidle0" });
  const pct = Number(await page.$eval('input[name="welcomePct"]', (el) => el.value));
  assert(pct > 0, `descuento de bienvenida configurado: ${pct} %`);
  await clickText(page, "button", "Guardar configuración");
  await page.waitForFunction(() => document.body.innerText.includes("Configuración guardada"), { timeout: 30000 });
  const ctx0 = browser.defaultBrowserContext();
  await ctx0.deleteCookie(...(await ctx0.cookies()));

  const { data: product } = await db.from("products").select("price_clp").eq("slug", "caicedo-blend-colombia").single();
  const unit = product.price_clp - Math.round((product.price_clp * pct) / 100);

  step("Llegar por el QR muestra la bienvenida una vez");
  await page.goto(`${BASE}/?utm_source=feria&utm_medium=qr`, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.removeItem("kaffa-bienvenida-vista"));
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="bienvenida-banner"]', { timeout: 10000 });
  assert((await page.$eval('[data-testid="bienvenida-banner"]', (el) => el.innerText)).includes(`${pct} %`), "el aviso muestra el porcentaje");
  await shot(page, "bienvenida-aviso");
  await clickText(page, '[data-testid="bienvenida-banner"] button', "Ver los cafés");
  await page.reload({ waitUntil: "networkidle0" });
  assert(!(await page.$('[data-testid="bienvenida-banner"]')), "cerrado, no vuelve a aparecer");

  step("Primera compra: el checkout descuenta y el servidor cobra lo mismo");
  await buyViaQr(page);
  const line = await page.$eval('[data-testid="bienvenida"]', (el) => el.innerText);
  assert(line.includes(clp(product.price_clp - unit)), `el checkout muestra −${clp(product.price_clp - unit)}`);
  await shot(page, "bienvenida-checkout");
  const first = await placeAndGetOrder(page);
  assert(first, "se creó el pedido");
  assert(first.order_items[0].unit_price_clp === unit && first.subtotal_clp === unit, `el pedido cobra ${clp(unit)} por la bolsa`);
  const { data: ev } = await db.from("events").select("data").eq("type", "pedido_creado").eq("entity_id", first.id).single();
  assert(ev.data.descuento_bienvenida === product.price_clp - unit && ev.data.fuente === "feria", "el registro guarda el descuento y el canal");
  await clickText(page, "button", "Aprobar pago");
  await page.waitForFunction(() => document.body.textContent.includes("aprobado"), { timeout: 20000 });

  step("Segunda compra con el mismo correo: avisa y cobra precio normal");
  const ctx = await browser.createBrowserContext();
  const p2 = await ctx.newPage();
  await p2.setViewport({ width: 1280, height: 900 });
  p2.on("dialog", (d) => d.accept());
  await buyViaQr(p2);
  assert(!!(await p2.$('[data-testid="bienvenida"]')), "el checkout ofrece el descuento (aún no sabe del correo)");
  const rejected = await placeAndGetOrder(p2);
  assert(rejected === null, "el servidor no crea el pedido con descuento");
  const alert = await p2.$eval('[role="alert"]', (el) => el.innerText);
  assert(alert.includes("primera compra online"), "explica por qué");
  assert(!(await p2.$('[data-testid="bienvenida"]')), "el descuento desaparece del resumen");
  const second = await placeAndGetOrder(p2);
  assert(second && second.subtotal_clp === product.price_clp, `al volver a pagar cobra el precio normal ${clp(product.price_clp)}`);
  await ctx.close();

  step("Sin venir del QR no hay descuento");
  const ctx3 = await browser.createBrowserContext();
  const p3 = await ctx3.newPage();
  await p3.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  await clickText(p3, "#molienda label", "Media");
  await clickText(p3, "button", "Agregar al carrito");
  await p3.waitForSelector('[role="status"]');
  await p3.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  assert(!(await p3.$('[data-testid="bienvenida"]')), "no se muestra el descuento");
  await ctx3.close();

  console.log("\nTodo OK");
} catch (e) {
  await shot(page, "bienvenida-error").catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
