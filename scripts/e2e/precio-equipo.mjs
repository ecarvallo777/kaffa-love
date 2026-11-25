// Prueba del precio equipo: un administrador con sesión paga costo + IVA + comisión, sin despacho gratis.
// Con otro correo en el checkout se cobra el precio normal (escribir un correo de admin no basta).
// Requiere `npm run dev` con pago simulado (sin MP_ACCESS_TOKEN). Crea y borra su propio administrador.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();
const ADMIN = "e2e-precio-equipo@kaffalove.test";
const clp = (n) => `$${n.toLocaleString("es-CL")}`;
const { browser, page } = await launch();
let orderId = null;
/** Reemplaza el contenido de un campo */
async function replace(el, value) {
  await el.click();
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");
  await el.type(value);
}

execFileSync("node", ["scripts/crear-usuario.mjs", ADMIN, "Prueba Precio Equipo", "admin"], { stdio: "ignore" });
const pass = /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${ADMIN}.txt`, "utf8"))[1].trim();

try {
  step("Producto de prueba y precio equipo esperado");
  const { data: s } = await db.storage.from("config").download("settings.json");
  const settings = JSON.parse(await s.text());
  const { data: candidates } = await db.from("products").select("id, slug, name, price_clp, stock, product_costs(cost_clp)").eq("type", "accesorio").eq("active", true).eq("visible_online", true).gte("stock", 4);
  const p = candidates.filter((x) => x.product_costs?.cost_clp).sort((a, b) => b.product_costs.cost_clp - a.product_costs.cost_clp)[0];
  const cost = p.product_costs.cost_clp;
  const staffUnit = Math.ceil(cost / (1 / (1 + settings.ivaPct / 100) - settings.mpTiendaPct / 100));
  const qty = Math.min(p.stock, Math.max(1, Math.ceil(settings.freeShippingFromClp / staffUnit)));
  console.log(`  ${p.name}: costo ${clp(cost)} → precio equipo ${clp(staffUnit)} (normal ${clp(p.price_clp)}) × ${qty}`);
  const net = staffUnit / (1 + settings.ivaPct / 100) - staffUnit * (settings.mpTiendaPct / 100);
  assert(net >= cost && net - cost < 2, `a la tienda le queda el costo (${Math.round(net)} ≈ ${cost})`);

  step("Ingresar como administrador y armar el carrito");
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', ADMIN);
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  await page.goto(`${BASE}/producto/${p.slug}`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle0" });
  for (let i = 1; i < qty; i++) await page.click('button[aria-label="Agregar uno"]');
  await clickText(page, "button", "Agregar al carrito");
  await page.waitForSelector('[role="status"]');

  step("Checkout: precio equipo con su correo");
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.waitForSelector('[data-testid="precio-equipo"]', { timeout: 20000 });
  const email = await page.$eval('input[type="email"]', (el) => el.value);
  assert(email === ADMIN, "el correo viene con el de la sesión");
  let text = await page.evaluate(() => document.body.innerText);
  assert(text.includes(clp(staffUnit * qty)), `muestra ${clp(staffUnit * qty)} por ${qty} unidades`);

  step("Despacho: tarifa normal aunque supere el monto de despacho gratis");
  await clickText(page, 'button[role="radio"]', "Despacho a domicilio");
  await page.select('select[autocomplete="address-level1"]', "Metropolitana de Santiago");
  await page.type('input[autocomplete="address-level2"]', "Providencia");
  await page.waitForFunction(() => document.body.innerText.includes("Despacho con Blue Express"), { timeout: 10000 });
  const shippingRow = () =>
    page.evaluate(() => [...document.querySelectorAll("dl div")].find((d) => d.innerText.startsWith("Despacho"))?.innerText ?? "");
  assert(!(await shippingRow()).includes("Gratis"), `despacho cobrado: ${(await shippingRow()).replace(/\s+/g, " ")}`);
  await shot(page, "precio-equipo-checkout");

  step("Con otro correo: precio normal y despacho gratis");
  const emailInput = await page.$('input[type="email"]');
  await replace(emailInput, "otra-persona@kaffalove.test");
  await page.waitForFunction(() => !document.querySelector('[data-testid="precio-equipo"]'), { timeout: 5000 });
  text = await page.evaluate(() => document.body.innerText);
  assert(text.includes(clp(p.price_clp * qty)), `precio normal ${clp(p.price_clp * qty)}`);
  if (p.price_clp * qty >= settings.freeShippingFromClp) assert((await shippingRow()).includes("Gratis"), "con precio normal sobre el monto, despacho gratis");

  step("Volver a su correo y crear el pedido");
  await replace(emailInput, ADMIN);
  await page.waitForSelector('[data-testid="precio-equipo"]');
  const fill = async (sel, v) => replace(await page.$(sel), v);
  await fill('input[autocomplete="name"]', "Prueba Precio Equipo");
  await fill('input[type="tel"]', "+56 9 1111 2222");
  await fill('input[autocomplete="address-line1"]', "Av. Prueba");
  // Número de la dirección: el campo que sigue a la calle
  await page.evaluate(() => {
    const street = document.querySelector('input[autocomplete="address-line1"]');
    const inputs = [...document.querySelectorAll("input")];
    const n = inputs[inputs.indexOf(street) + 1];
    n.focus();
  });
  await page.keyboard.type("123");
  await clickText(page, "button", "Pagar");
  await page.waitForFunction(() => location.pathname.startsWith("/dev/pago-simulado/") || document.querySelector('[role="alert"]'), { timeout: 30000 });
  const alert = await page.$eval('[role="alert"]', (el) => el.textContent).catch(() => null);
  assert(!alert, `pedido creado${alert ? `: ${alert}` : ""}`);
  orderId = page.url().split("/").pop().split("?")[0];
  const { data: order } = await db.from("orders").select("subtotal_clp, shipping_clp, total_clp, order_items(unit_price_clp, quantity)").eq("id", orderId).single();
  assert(order.order_items[0].unit_price_clp === staffUnit, `el servidor cobra ${clp(staffUnit)} por unidad`);
  assert(order.shipping_clp > 0, `envío cobrado ${clp(order.shipping_clp)}`);
  const { data: ev } = await db.from("events").select("data").eq("entity_id", orderId).eq("type", "pedido_creado").single();
  assert(ev.data.precio_equipo === true, "el pedido queda marcado como precio equipo");
  console.log("\nTodo OK");
} catch (e) {
  console.error(e.message);
  await shot(page, "precio-equipo-error").catch(() => {});
  process.exitCode = 1;
} finally {
  if (orderId) {
    await db.rpc("release_order_stock", { p_order_id: orderId });
    await db.from("stock_movements").delete().eq("order_id", orderId);
    await db.from("events").delete().eq("entity_id", orderId);
    await db.from("orders").delete().eq("id", orderId);
  }
  const { data: c } = await db.from("customers").select("id").eq("email", ADMIN).maybeSingle();
  if (c) {
    await db.from("addresses").delete().eq("customer_id", c.id);
    await db.storage.from("carritos").remove([`${c.id}.json`]);
    await db.from("customers").delete().eq("id", c.id);
  }
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  const u = list.users.find((x) => x.email === ADMIN);
  if (u) {
    await db.from("staff").delete().eq("user_id", u.id);
    await db.auth.admin.deleteUser(u.id);
  }
  fs.rmSync(`.credenciales-${ADMIN}.txt`, { force: true });
  await browser.close();
}
