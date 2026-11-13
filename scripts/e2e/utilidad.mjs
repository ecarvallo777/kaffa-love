// Prueba de costos y utilidad real, reportes, inventario y "Nosotros".
// Requiere `npm run dev` y los usuarios e2e-admin y e2e-operador (scripts/crear-usuario.mjs).
// Restaura los costos al terminar; los datos de prueba se borran con limpiar.mjs.
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();
const pass = (email) => /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${email}.txt`, "utf8"))[1].trim();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());
const text = () => page.$eval("body", (el) => el.innerText);
const ready = () => page.waitForFunction(() => !document.body.innerText.includes("Cargando"), { timeout: 90000 });
const goto = async (url) => {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0" });
  await ready();
};
async function login(email) {
  const ctx = browser.defaultBrowserContext();
  await ctx.deleteCookie(...(await ctx.cookies()));
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', pass(email));
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  await ready();
}
const readJson = async (file) => {
  const { data } = await db.storage.from("config").download(file);
  return data ? JSON.parse(await data.text()) : null;
};
const { data: americano } = await db.from("products").select("id").eq("slug", "americano").single();
const costOf = async (id) => (await db.from("product_costs").select("cost_clp").eq("product_id", id).maybeSingle()).data?.cost_clp ?? null;
const costBefore = await costOf(americano.id);

try {
  step("Producto: costo unitario y margen");
  await login("e2e-admin@kaffalove.test");
  await goto(`/admin/productos/${americano.id}`);
  await page.$eval('input[name="cost_clp"]', (el) => (el.value = ""));
  await page.type('input[name="cost_clp"]', "800");
  await page.waitForFunction(() => document.body.innerText.includes("margen bruto"));
  assert((await text()).includes("margen bruto"), "muestra el margen al escribir el costo");
  await clickText(page, "button", "Guardar cambios");
  await page.waitForFunction(() => document.body.innerText.includes("Cambios guardados"), { timeout: 20000 });
  assert((await costOf(americano.id)) === 800, "costo guardado");

  step("Feria de prueba: 2 americanos");
  await login("e2e-operador@kaffalove.test");
  await goto("/feria");
  await page.type('input[name="name"]', "[PRUEBA] Utilidad");
  await clickText(page, "button", "Abrir jornada");
  await page.waitForFunction(() => document.body.innerText.includes("[PRUEBA] Utilidad"), { timeout: 30000 });
  await clickText(page, "button", "Preparados");
  await clickText(page, "button", "Americano");
  await clickText(page, "button", "Americano");
  await clickText(page, "button", "Cobrar");
  await page.waitForFunction(() => document.body.innerText.includes("Cobro aprobado"));
  await clickText(page, "button", "Cobro aprobado");
  await page.waitForFunction(() => document.body.innerText.includes("registrada"), { timeout: 20000 });
  await goto("/feria/cierre");
  await clickText(page, "button", "Cerrar jornada");
  await page.waitForFunction(() => document.body.innerText.toLowerCase().includes("jornada cerrada"), { timeout: 30000 });
  assert(true, "venta de $5.000 y jornada cerrada");

  step("Administración: gastos y utilidad real de la feria");
  await login("e2e-admin@kaffalove.test");
  const { data: session } = await db.from("fair_sessions").select("id").eq("name", "[PRUEBA] Utilidad").order("opened_at", { ascending: false }).limit(1).single();
  await goto(`/admin/ferias/${session.id}`);
  await page.type('input[placeholder="Monto"]', "1000");
  await page.type('input[aria-label="Detalle"]', "[PRUEBA] stand");
  await clickText(page, "button", "Guardar gastos");
  await page.waitForFunction(() => document.body.innerText.includes("Gastos guardados"), { timeout: 20000 });
  await goto(`/admin/ferias/${session.id}`);
  const settings = (await readJson("settings.json")) ?? {};
  const ivaPct = settings.ivaPct ?? 19;
  const mp = settings.mpFeriaPct ?? 0;
  const gross = 5000;
  const net = Math.round(gross - (gross * ivaPct) / (100 + ivaPct));
  const expected = Math.round(gross - (gross * ivaPct) / (100 + ivaPct) - 1600 - (gross * mp) / 100 - 1000);
  const fmt = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
  const body = await text();
  assert(body.includes(fmt(net)), `ventas netas ${fmt(net)}`);
  assert(body.includes(fmt(1600)), "costo de productos $1.600 (2 × $800)");
  assert(body.includes(fmt(expected)), `utilidad ${fmt(expected)}`);
  await shot(page, "utilidad-01-feria");

  step("Listado de ferias con utilidad");
  await goto("/admin/ferias");
  assert((await text()).includes(fmt(expected)), "utilidad en el listado");

  step("Reportes");
  await goto("/admin/reportes?p=7d&c=todos");
  const rep = await text();
  assert(rep.toLowerCase().includes("utilidad real") && rep.includes("Productos que más venden"), "dashboard con indicadores y rankings");
  assert(rep.includes("[PRUEBA] Utilidad"), "la feria aparece en el ranking");
  await shot(page, "utilidad-02-reportes");
  await page.hover("figure button");
  await sleep(300);
  assert(!!(await page.$('[role="tooltip"]')), "tooltip al pasar sobre una columna");
  await goto("/admin/reportes?p=30d&c=feria");
  assert((await text()).includes("Horas de más venta en feria"), "filtro de canal feria");

  step("Inventario: conteo con diferencia");
  const { data: filtro } = await db.from("products").select("id, stock").eq("slug", "filtros-02-100").single();
  await goto("/admin/inventario");
  const expectedFiltros = await page.$eval(`input[aria-label="Unidades contadas de Filtros 02 (100 unidades)"]`, (el) => Number(el.placeholder));
  await page.type(`input[aria-label="Unidades contadas de Filtros 02 (100 unidades)"]`, String(expectedFiltros + 1));
  await page.type('input[name="note"]', "[PRUEBA] conteo");
  assert((await text()).includes("+1"), "muestra la diferencia +1");
  await shot(page, "utilidad-03-inventario");
  await clickText(page, "button", "Aplicar conteo");
  await page.waitForFunction(() => document.body.innerText.includes("Conteo aplicado"), { timeout: 30000 });
  const { data: filtroAfter } = await db.from("products").select("stock").eq("id", filtro.id).single();
  assert(filtroAfter.stock === filtro.stock + 1, "stock ajustado en +1");

  step("Nosotros");
  await goto("/nosotros");
  const n = await text();
  assert(n.includes("Kaffa Love nace del amor por el café") && n.includes("Kaffa Lovers"), "texto de Nosotros");
  assert(await page.$eval("main img", (img) => img.complete && img.naturalWidth > 0), "foto cargada");
  assert(await page.$('header a[href="/nosotros"]'), "enlace en el menú");
  await shot(page, "utilidad-04-nosotros");

  console.log("\nOK");
} catch (e) {
  await shot(page, "utilidad-error").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  // Restaurar el costo del americano como estaba
  if (costBefore === null) await db.from("product_costs").delete().eq("product_id", americano.id);
  else await db.from("product_costs").upsert({ product_id: americano.id, cost_clp: costBefore });
  await browser.close();
}
