// Prueba de recetas: crear en la administración, receta según la molienda elegida,
// "Usar esta molienda" y temporizador. Requiere `npm run dev` y el usuario
// e2e-admin@kaffalove.test (scripts/crear-usuario.mjs). Borra la receta al terminar.
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";

const TITLE = "Prensa francesa [PRUEBA]";
const pass = /Contraseña: (.+)/.exec(fs.readFileSync(".credenciales-e2e-admin@kaffalove.test.txt", "utf8"))[1].trim();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());
const text = () => page.$eval("body", (el) => el.innerText);
const ready = () => page.waitForFunction(() => !document.body.innerText.includes("Cargando"), { timeout: 90000 });
const recipeTitle = () => page.$eval("#receta h2", (el) => el.textContent.trim());

try {
  step("Administración: crear receta de prensa francesa para Caicedo");
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', "e2e-admin@kaffalove.test");
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  await page.goto(`${BASE}/admin/recetas`, { waitUntil: "networkidle0" });
  await ready();
  assert((await text()).includes("Filtrado en V60 o Chemex"), "receta inicial de V60 en la lista");
  await shot(page, "recetas-01-lista");

  await page.goto(`${BASE}/admin/recetas/nueva`, { waitUntil: "networkidle0" });
  await ready();
  await page.type('input[name="title"]', TITLE);
  await page.type('input[name="method"]', "Prensa");
  await page.$eval('input[name="coffeeGrams"]', (el) => (el.value = ""));
  await page.type('input[name="coffeeGrams"]', "30");
  await page.$eval('input[name="waterMl"]', (el) => (el.value = ""));
  await page.type('input[name="waterMl"]', "500");
  await page.select('select[name="grind"]', "gruesa");
  await page.type('textarea[placeholder="Qué hacer en este paso"]', "Vierte el agua sobre el café.");
  await page.type('input[type="number"][max="3600"]', "3");
  await clickText(page, "button", "Agregar paso");
  const areas = await page.$$('textarea[placeholder="Qué hacer en este paso"]');
  await areas[1].type("Presiona el émbolo y sirve.");
  const secs = await page.$$('input[type="number"][max="3600"]');
  await secs[1].type("2");
  await clickText(page, "label", "Caicedo Blend");
  await shot(page, "recetas-02-formulario");
  await clickText(page, "button", "Crear receta");
  await page.waitForFunction(() => location.pathname.startsWith("/admin/recetas/") && !location.pathname.endsWith("/nueva"), { timeout: 30000 });
  const editUrl = page.url();
  assert(true, "receta creada");

  step("Ficha del café: receta destacada al abrir");
  await page.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#receta");
  assert((await recipeTitle()) === "Filtrado en V60 o Chemex", "muestra la destacada (V60) sin molienda elegida");
  assert((await page.$$('#receta [role="tab"]')).length === 2, "pestañas con las dos recetas");

  step("Elegir molienda gruesa muestra la receta de prensa");
  await clickText(page, "#molienda label", "Gruesa");
  await sleep(200);
  assert((await recipeTitle()) === TITLE, "la receta cambió a prensa francesa");
  assert((await page.$eval("#molienda", (el) => el.innerText)).includes("Con esta molienda: Prensa"), "resumen bajo el selector");
  await shot(page, "recetas-03-gruesa", false);

  step("Molienda sin receta: consejo general y receta destacada");
  await clickText(page, "#molienda label", "Fina");
  await sleep(200);
  assert((await page.$eval("#molienda", (el) => el.innerText)).includes("Molienda fina"), "consejo general para fina");
  assert((await recipeTitle()) === "Filtrado en V60 o Chemex", "vuelve a la destacada");

  step("«Usar molienda media» marca el selector");
  await clickText(page, "#receta button", "Usar molienda media");
  await sleep(300);
  assert(await page.$eval('#molienda input[value="media"]', (el) => el.checked), "selector en molienda media");
  assert((await page.$eval("#receta", (el) => el.innerText)).includes("es la indicada"), "la receta confirma la molienda");

  step("Temporizador de la receta de prensa (5 s)");
  await clickText(page, "#molienda label", "Gruesa");
  await sleep(200);
  await clickText(page, "#receta button", "Iniciar temporizador");
  await sleep(1200);
  assert((await page.$eval("#receta", (el) => el.innerText)).includes("Ahora: Vierte el agua"), "resalta el paso en curso");
  await shot(page, "recetas-04-temporizador", false);
  await page.waitForFunction(() => document.querySelector("#receta").innerText.includes("Extracción terminada"), { timeout: 15000 });
  assert(true, "temporizador terminó");

  step("Borrar la receta de prueba");
  await page.goto(editUrl, { waitUntil: "networkidle0" });
  await ready();
  await clickText(page, "button", "Eliminar receta");
  await page.waitForFunction(() => location.pathname === "/admin/recetas", { timeout: 30000 });
  assert(!(await text()).includes(TITLE), "receta eliminada");

  console.log("\nOK");
} catch (e) {
  await shot(page, "recetas-error").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
