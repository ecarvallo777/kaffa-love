// Prueba del equipo: login, permisos, feria completa y administración.
// Requiere `npm run dev` y los usuarios de prueba creados con scripts/crear-usuario.mjs
// (e2e-admin@kaffalove.test y e2e-operador@kaffalove.test).
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";
import { adminDb, stockOf } from "./db.mjs";

const pass = (email) => /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${email}.txt`, "utf8"))[1].trim();
const db = adminDb();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());

async function login(email) {
  await goto(`${BASE}/ingresar`);
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', pass(email));
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click('button')]);
  await ready();
}
async function logout() {
  const ctx = browser.defaultBrowserContext();
  await ctx.deleteCookie(...(await ctx.cookies()));
}
const text = () => page.$eval("body", (el) => el.textContent);
const ready = () => page.waitForFunction(() => !document.body.innerText.includes("Cargando…"), { timeout: 90000 });
async function goto(url) {
  await page.goto(url, { waitUntil: "networkidle0" });
  await ready();
}

try {
  step("Sin sesión, /admin redirige al login");
  await goto(`${BASE}/admin`);
  assert(page.url().includes("/ingresar"), "redirige a /ingresar");

  step("Contraseña incorrecta");
  await page.type('input[name="email"]', "e2e-operador@kaffalove.test");
  await page.type('input[name="password"]', "incorrecta-123");
  await page.click("button");
  await page.waitForSelector('[role="alert"]');
  assert((await text()).includes("incorrectos"), "muestra error");

  step("Operador entra a la feria y no a la administración");
  await login("e2e-operador@kaffalove.test");
  assert(page.url().endsWith("/feria"), "operador llega a /feria");
  await page.goto(`${BASE}/admin`);
  await page.waitForFunction(() => location.pathname === "/feria", { timeout: 30000 });
  await ready();
  assert(page.url().endsWith("/feria"), "operador no puede ver /admin");

  // Cierra una jornada abierta que haya quedado de una prueba anterior
  if ((await text()).includes("Cerrar jornada")) {
    await goto(`${BASE}/feria/cierre`);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), clickText(page, "button", "Cerrar jornada")]);
    await goto(`${BASE}/feria`);
  }

  step("Abrir jornada con 5 tortas");
  const { data: torta } = await db.from("products").select("id").eq("slug", "torta").single();
  await page.type('input[name="name"]', "[PRUEBA] Feria e2e");
  await page.$eval(`input[name="prep_${torta.id}"]`, (el) => (el.value = ""));
  await page.type(`input[name="prep_${torta.id}"]`, "5");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), clickText(page, "button", "Abrir jornada")]);
  assert((await text()).includes("[PRUEBA] Feria e2e"), "jornada abierta");
  const before = await stockOf(db, ["caicedo-blend-colombia", "torta"]);
  assert(before.torta === 5, "torta con 5 unidades");

  step("Venta: 1 Caicedo (gruesa), 2 americanos, 1 torta");
  await clickText(page, "button", "Caicedo Blend");
  await page.waitForSelector(".fixed");
  await clickText(page, ".fixed button", "Gruesa");
  await clickText(page, "button", "Preparados");
  await clickText(page, "button", "Americano");
  await clickText(page, "button", "Americano");
  await clickText(page, "button", "Torta");
  assert((await text()).includes("$21.800"), "total $21.800 (13.300 + 2×2.500 + 3.500)");
  await shot(page, "feria-01-carrito", false);
  await clickText(page, "button", "Cobrar");
  await page.waitForFunction(() => document.body.textContent.includes("Ingresa en Mercado Pago Point"));
  await shot(page, "feria-02-cobro", false);
  await clickText(page, "button", "Cobro aprobado");
  await page.waitForFunction(() => document.body.textContent.includes("registrada"), { timeout: 20000 });
  await sleep(800);
  await shot(page, "feria-03-venta-ok", false);
  let after = await stockOf(db, ["caicedo-blend-colombia", "torta"]);
  assert(after["caicedo-blend-colombia"] === before["caicedo-blend-colombia"] - 1, "descontó 1 Caicedo del stock compartido");
  assert(after.torta === 4, "descontó 1 torta");

  step("Anular la venta devuelve el stock");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Anular"), { timeout: 20000 });
  await clickText(page, "button", "Anular");
  await page.waitForFunction(() => document.body.textContent.includes("anulada"), { timeout: 20000 });
  after = await stockOf(db, ["caicedo-blend-colombia", "torta"]);
  assert(after["caicedo-blend-colombia"] === before["caicedo-blend-colombia"] && after.torta === 5, "stock devuelto");

  step("Segunda venta y cierre con diferencia");
  await clickText(page, "button", "Preparados");
  await clickText(page, "button", "Espresso");
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Cobrar" && !b.disabled));
  await clickText(page, "button", "Cobrar");
  await page.waitForFunction(() => document.body.textContent.includes("Cobro aprobado"));
  await clickText(page, "button", "Cobro aprobado");
  await page.waitForFunction(() => document.body.textContent.includes("registrada"), { timeout: 20000 });
  await goto(`${BASE}/feria/cierre`);
  assert((await text()).includes("$2.000"), "resumen con $2.000");
  await page.type('input[name="pointTotal"]', "2500");
  await sleep(200);
  assert((await text()).includes("Diferencia de $500"), "muestra diferencia con Point");
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), clickText(page, "button", "Cerrar jornada")]);
  assert((await text()).includes("Jornada cerrada"), "jornada cerrada");
  await shot(page, "feria-04-cierre", false);

  step("Administrador: resumen");
  await logout();
  await login("e2e-admin@kaffalove.test");
  assert(page.url().endsWith("/admin"), "admin llega a /admin");
  await shot(page, "admin-01-resumen");
  assert((await text()).includes("Antes de vender"), "muestra lista de configuración pendiente");

  step("Pedidos y ferias");
  await goto(`${BASE}/admin/pedidos?canal=feria`);
  assert((await text()).includes("Venta en feria"), "lista ventas de feria");
  await goto(`${BASE}/admin/ferias`);
  assert((await text()).includes("[PRUEBA] Feria e2e"), "jornada en historial");
  await shot(page, "admin-02-ferias");

  step("Pedido online: preparar → listo para retiro → retirado");
  const { data: testOrder } = await db
    .from("orders")
    .select("id, customers!inner(email)")
    .eq("status", "pagado")
    .eq("channel", "online")
    .like("customers.email", "%@kaffalove.test")
    .limit(1)
    .maybeSingle();
  if (testOrder) {
    await goto(`${BASE}/admin/pedidos/${testOrder.id}`);
    await shot(page, "admin-03-pedido");
    for (const [label, expected] of [["Marcar en preparación", "en_preparacion"], ["Listo para retiro", "listo_retiro"], ["Marcar retirado", "entregado"]]) {
      await clickText(page, "button", label);
      for (let i = 0; i < 40; i++) {
        const { data } = await db.from("orders").select("status").eq("id", testOrder.id).single();
        if (data.status === expected) break;
        await sleep(500);
      }
      await sleep(1500);
    }
    const { data: o } = await db.from("orders").select("status").eq("id", testOrder.id).single();
    assert(o.status === "entregado", "pedido entregado");
  } else {
    console.log("  (sin pedido online de prueba: corre antes scripts/e2e/compra.mjs)");
  }

  step("Ajuste de stock con motivo");
  await goto(`${BASE}/admin/stock`);
  const { data: chemex } = await db.from("products").select("id, stock").eq("slug", "cafetera-chemex-400").single();
  await page.select('select[name="productId"]', chemex.id);
  await page.select('select[name="mode"]', "sumar");
  await page.type('input[name="qty"]', "2");
  await page.select('select[name="reason"]', "ajuste");
  await page.type('input[name="note"]', "[PRUEBA] conteo e2e");
  await clickText(page, "button", "Guardar movimiento");
  await page.waitForFunction(() => document.body.innerText.includes("unidades."), { timeout: 20000 });
  const { data: chemexAfter } = await db.from("products").select("stock").eq("id", chemex.id).single();
  assert(chemexAfter.stock === chemex.stock + 2, "stock sumado y registrado");
  await shot(page, "admin-04-stock");

  step("Producto: editar y guardar");
  const { data: betania } = await db.from("products").select("id").eq("slug", "la-betania-colombia").single();
  await goto(`${BASE}/admin/productos/${betania.id}`);
  await shot(page, "admin-05-producto");
  await clickText(page, "button", "Guardar cambios");
  await page.waitForFunction(() => document.body.textContent.includes("Cambios guardados"), { timeout: 20000 });
  assert(true, "producto guardado");

  for (const [path, name] of [["/admin/configuracion", "admin-06-config"], ["/admin/retiro", "admin-07-retiro"], ["/admin/equipo", "admin-08-equipo"], ["/admin/inventario", "admin-09-inventario"], ["/admin/productos/nuevo", "admin-10-nuevo"]]) {
    await goto(`${BASE}${path}`);
    assert(!(await text()).includes("Application error"), `${path} carga`);
    await shot(page, name);
  }

  console.log("\nOK");
} catch (e) {
  await shot(page, "equipo-error").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
