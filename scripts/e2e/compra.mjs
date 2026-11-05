// Prueba de compra online completa con el pago simulado.
// Requiere `npm run dev` corriendo y SIN MP_ACCESS_TOKEN (modo simulado).
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();

const { browser, page } = await launch({ mobile: process.argv.includes("--mobile") });
const tag = process.argv.includes("--mobile") ? "m-" : "";

try {
  step("Ficha de café: agregar sin molienda debe pedirla");
  await page.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  await clickText(page, "button", "Agregar");
  await page.waitForSelector('[role="alert"]');
  assert(await page.$eval('[role="alert"]', (el) => el.textContent.includes("molienda")), "pide elegir molienda");

  step("Elegir molienda media, 2 unidades y agregar");
  await clickText(page, "label", "Media");
  await page.click('button[aria-label="Agregar uno"]');
  await clickText(page, "button", "Agregar");
  await page.waitForSelector('[role="status"]');
  await shot(page, `${tag}01-toast`, false);
  assert((await page.$eval('[role="status"]', (el) => el.textContent)).includes("Agregado"), "aviso de agregado");

  step("Agregar promoción Cafetera + Tetera");
  await page.goto(`${BASE}/producto/promo-cafetera-tetera`, { waitUntil: "networkidle0" });
  await clickText(page, "button", "Agregar");
  await sleep(300);

  step("Carrito");
  await page.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  await sleep(300);
  const lines = await page.$$eval("main li", (els) => els.length);
  assert(lines >= 2, `carrito con ${lines} líneas`);
  const cartText = await page.$eval("main", (el) => el.textContent);
  assert(cartText.includes("$55.550"), "subtotal $55.550 (2 × 13.300 + 28.950)");
  await shot(page, `${tag}02-carrito`);

  step("Checkout con retiro");
  await clickText(page, "a", "Continuar con la compra");
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', "prueba+e2e@kaffalove.test");
  await page.type('input[autocomplete="name"]', "Cliente de Prueba");
  await page.type('input[type="tel"]', "+56 9 1234 5678");
  await shot(page, `${tag}03-checkout`);
  await clickText(page, "button", "Pagar");
  await page.waitForFunction(() => location.pathname.startsWith("/dev/pago-simulado/"), { timeout: 20000 });
  const orderId = page.url().split("/").pop();
  assert(!!orderId, `pedido creado ${orderId}`);

  // Se revisan los movimientos de ESTE pedido (otras compras pueden ocurrir en paralelo)
  const { data: moves } = await db.from("stock_movements").select("delta, products(slug)").eq("order_id", orderId);
  const moved = Object.fromEntries(moves.map((m) => [m.products.slug, m.delta]));
  assert(moved["caicedo-blend-colombia"] === -2, "reservó 2 Caicedo");
  assert(moved["cafetera-chemex-400"] === -1, "reservó 1 Chemex (promo)");
  assert(moved["tetera-cisne-350"] === -1, "reservó 1 tetera (promo)");

  step("Aprobar pago simulado");
  await shot(page, `${tag}04-pago-simulado`);
  await clickText(page, "button", "Aprobar pago");
  await page.waitForFunction(() => location.pathname.startsWith("/pedido/"), { timeout: 20000 });
  await page.waitForFunction(() => document.body.textContent.includes("aprobado"), { timeout: 20000 });
  await shot(page, `${tag}05-pedido-pagado`);

  const { data: order } = await db.from("orders").select("status, total_clp, mp_payment_id, order_items(grind, quantity)").eq("id", orderId).single();
  assert(order.status === "pagado", "pedido pagado en la base");
  assert(order.total_clp === 55550, "total $55.550 con retiro gratis");
  assert(order.order_items.some((i) => i.grind === "media" && i.quantity === 2), "molienda guardada");
  const { data: events } = await db.from("events").select("type").eq("entity_id", orderId);
  const types = events.map((e) => e.type);
  assert(types.includes("pedido_creado") && types.includes("pago_confirmado"), `eventos: ${types.join(", ")}`);

  const cartCount = await page.$eval('a[href="/carrito"]', (el) => el.textContent);
  assert(cartCount.includes("0"), "carrito vacío tras comprar");

  step("Crear cuenta después de pagar y ver el historial");
  await page.waitForSelector('input[name="password"]');
  await page.type('input[name="password"]', "clave-e2e-segura");
  await clickText(page, "button", "Crear cuenta");
  await page.waitForFunction(() => location.pathname === "/cuenta", { timeout: 20000 });
  await page.waitForFunction(() => document.body.innerText.includes("Volver a comprar"), { timeout: 20000 });
  await shot(page, `${tag}06-cuenta`);
  assert(true, "cuenta creada y pedido en el historial");

  step("Volver a comprar llena el carrito");
  await clickText(page, "button", "Volver a comprar");
  await page.waitForFunction(() => location.pathname === "/carrito", { timeout: 20000 });
  await sleep(500);
  assert((await page.$eval("main", (el) => el.textContent)).includes("$55.550"), "carrito con el pedido anterior");

  console.log(`\nOK · pedido ${orderId}`);
} catch (e) {
  await shot(page, `${tag}error`).catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
