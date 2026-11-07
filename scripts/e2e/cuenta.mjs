// Prueba de cuentas de cliente: datos guardados en el checkout y carrito
// compartido entre dispositivos (cada "dispositivo" es un contexto de navegador aparte).
// Requiere `npm run dev` sin MP_ACCESS_TOKEN (pago simulado).
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";

const EMAIL = "prueba+cuenta@kaffalove.test";
const PASS = "clave-cuenta-e2e";
const { browser, page } = await launch();
const ready = (p) => p.waitForFunction(() => !document.body.innerText.includes("Cargando"), { timeout: 60000 });

async function newDevice() {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  p.on("dialog", (d) => d.accept());
  return p;
}
async function login(p) {
  await p.goto(`${BASE}/cuenta`, { waitUntil: "networkidle0" });
  await p.waitForSelector('input[name="email"]');
  await p.type('input[name="email"]', EMAIL);
  await p.type('input[name="password"]', PASS);
  await clickText(p, "button", "Ingresar");
  // "Cerrar sesión" solo aparece con sesión iniciada (el login también menciona "tus pedidos")
  await p.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Cerrar sesión")) || document.querySelector('[role="alert"]'),
    { timeout: 30000 },
  );
  const err = await p.$eval('[role="alert"]', (el) => el.textContent).catch(() => null);
  if (err) throw new Error(`No se pudo iniciar sesión: ${err}`);
}
async function addCoffee(p, slug, grind) {
  await p.goto(`${BASE}/producto/${slug}`, { waitUntil: "networkidle0" });
  await clickText(p, "#molienda label", grind);
  await clickText(p, "button", "Agregar al carrito");
  await p.waitForSelector('[role="status"]');
}

try {
  step("Dispositivo A: compra con despacho y crea su cuenta");
  await addCoffee(page, "caicedo-blend-colombia", "Media");
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[autocomplete="name"]', "Cliente Cuenta");
  await page.type('input[type="tel"]', "+56 9 8765 4321");
  await clickText(page, 'button[role="radio"]', "Despacho a domicilio");
  await page.select('select[autocomplete="address-level1"]', "Metropolitana de Santiago");
  await page.type('input[autocomplete="address-level2"]', "Providencia");
  await page.type('input[autocomplete="address-line1"]', "Av. Prueba");
  await page.type('input[inputmode="numeric"]', "1234");
  await clickText(page, "button", "Pagar");
  await page.waitForFunction(() => location.pathname.startsWith("/dev/pago-simulado/"), { timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes("Aprobar pago"), { timeout: 60000 });
  await clickText(page, "button", "Aprobar pago");
  await page.waitForSelector('input[name="password"]', { timeout: 30000 });
  await page.type('input[name="password"]', PASS);
  await clickText(page, "button", "Crear cuenta");
  await page.waitForFunction(() => location.pathname === "/cuenta", { timeout: 30000 });
  assert(true, "cuenta creada");

  step("Dispositivo B: inicia sesión y el checkout trae sus datos");
  const b = await newDevice();
  await login(b);
  await addCoffee(b, "la-betania-colombia", "Fina");
  await b.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await ready(b);
  await b.waitForSelector('input[type="email"]');
  const email = await b.$eval('input[type="email"]', (el) => ({ value: el.value, readOnly: el.readOnly }));  assert(email.value === EMAIL && email.readOnly, "correo de la cuenta, no editable");
  assert((await b.$eval('input[autocomplete="name"]', (el) => el.value)) === "Cliente Cuenta", "nombre guardado");
  assert((await b.$eval('input[type="tel"]', (el) => el.value)) === "+56 9 8765 4321", "teléfono guardado");
  await clickText(b, 'button[role="radio"]', "Despacho a domicilio");
  assert((await b.$eval('input[autocomplete="address-line1"]', (el) => el.value)) === "Av. Prueba", "dirección guardada");
  assert((await b.$eval('select[autocomplete="address-level1"]', (el) => el.value)) === "Metropolitana de Santiago", "región guardada");
  assert((await b.$$eval("option", (os) => os.some((o) => o.textContent.includes("Av. Prueba 1234")))), "dirección en 'Tus direcciones'");
  await shot(b, "cuenta-01-checkout-con-datos");

  step("Dispositivo C: el carrito de B aparece al iniciar sesión");
  await sleep(1500); // deja que B guarde su carrito
  const c = await newDevice();
  await login(c);
  await c.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  await c.waitForFunction(() => document.querySelector("main").innerText.includes("La Betania"), { timeout: 20000 });
  assert(true, "carrito sincronizado entre dispositivos");
  await shot(c, "cuenta-02-carrito-otro-dispositivo");

  step("Quitar en C se refleja en un dispositivo nuevo");
  await clickText(c, "button", "Quitar");
  await sleep(300);
  await c.goto(`${BASE}/`, { waitUntil: "networkidle0" }); // navegar guarda el cambio
  await sleep(1500);
  const d = await newDevice();
  await login(d);
  await d.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  await d.waitForFunction(() => document.querySelector("main").innerText.includes("Tu carrito está vacío"), { timeout: 20000 });
  assert(true, "carrito vacío también en el dispositivo D");

  step("Cerrar sesión en B deja su carrito fuera de la vista");
  await b.goto(`${BASE}/cuenta`, { waitUntil: "networkidle0" });
  await clickText(b, "button", "Cerrar sesión");
  await b.waitForFunction(() => location.pathname === "/", { timeout: 20000 });
  await b.waitForFunction(() => document.querySelector('a[href="/carrito"]')?.textContent.includes("0"), { timeout: 20000 });
  assert(true, "carrito local vacío tras cerrar sesión");

  console.log("\nOK");
} catch (e) {
  await shot(page, "cuenta-error").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
