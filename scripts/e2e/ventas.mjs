// Prueba de las herramientas de venta: registro anÃ³nimo del embudo, sugerencias
// en el carrito, enlace "retomar compra" de los correos y baja con enlace firmado.
// AdemÃ¡s valida (sin enviar nada) las consultas de los correos automÃ¡ticos.
// Solo lee pedidos existentes; al final borra los eventos que generÃ³.
import crypto from "node:crypto";
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";
import { adminDb, loadEnv } from "./db.mjs";

const db = adminDb();
const env = { ...loadEnv(), ...process.env };
const { browser, page } = await launch();
const aids = new Set(["11111111-1111-4111-8111-111111111111"]);
// El registro ignora navegadores "Headless" (bots): se usa un agente de usuario normal
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0";
await page.setUserAgent(UA);

const ORDER_SELECT =
  "id, number, created_at, paid_at, customer_id, customers!inner (id, email, name, marketing_consent), order_items (product_id, product_name, quantity, unit_price_clp, grind)";

async function eventsFor(aid) {
  // El registro se guarda de forma asÃ­ncrona (sendBeacon): se espera un poco
  for (let i = 0; i < 20; i++) {
    const { data } = await db.from("events").select("type").eq("data->>aid", aid);
    const types = (data ?? []).map((e) => e.type);
    if (types.includes("vista_producto") && types.includes("agrego_carrito")) return types;
    await sleep(500);
  }
  const { data } = await db.from("events").select("type").eq("data->>aid", aid);
  return (data ?? []).map((e) => e.type);
}

try {
  step("Consultas de los correos automÃ¡ticos (sin enviar)");
  const now = Date.now();
  const q1 = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("channel", "online")
    .eq("status", "expirado")
    .eq("customers.marketing_consent", true)
    .gte("created_at", new Date(now - 48 * 3600_000).toISOString())
    .lte("created_at", new Date(now - 3600_000).toISOString())
    .limit(5);
  assert(!q1.error, `consulta de carritos abandonados vÃ¡lida${q1.error ? `: ${q1.error.message}` : ""}`);
  const q2 = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("channel", "online")
    .in("status", ["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"])
    .eq("customers.marketing_consent", true)
    .gte("paid_at", new Date(now - 23 * 86400_000).toISOString())
    .lte("paid_at", new Date(now - 18 * 86400_000).toISOString())
    .limit(5);
  assert(!q2.error, `consulta de recompra vÃ¡lida${q2.error ? `: ${q2.error.message}` : ""}`);
  const q4 = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("channel", "online")
    .in("status", ["despachado", "listo_retiro", "entregado"])
    .eq("customers.marketing_consent", true)
    .gte("paid_at", new Date(now - 12 * 86400_000).toISOString())
    .lte("paid_at", new Date(now - 7 * 86400_000).toISOString())
    .limit(5);
  assert(!q4.error, `consulta de pedido de reseñas válida${q4.error ? `: ${q4.error.message}` : ""}`);
  assert((q1.data ?? []).every((o) => o.customers.marketing_consent), "solo trae clientes que aceptaron novedades");
  const q3 = await db.from("events").select("id", { count: "exact", head: true }).eq("type", "correo_abandono").eq("data->>customer_id", crypto.randomUUID());
  assert(!q3.error, "consulta de correos ya enviados vÃ¡lida");
  console.log(`  (hoy calificarÃ­an ${q1.data?.length ?? 0} carritos y ${q2.data?.length ?? 0} recompras; solo producciÃ³n envÃ­a)`);

  step("Embudo: ver un cafÃ© y agregarlo al carrito");
  await page.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  await clickText(page, "#molienda label", "Media");
  await clickText(page, "button", "Agregar al carrito");
  await page.waitForSelector('[role="status"]');
  const aid = await page.evaluate(() => localStorage.getItem("kaffa-aid"));
  assert(/^[0-9a-f-]{36}$/.test(aid ?? ""), "el navegador tiene un identificador anÃ³nimo");
  aids.add(aid);
  const types = await eventsFor(aid);
  assert(types.includes("vista_producto"), "se registrÃ³ la vista del producto");
  assert(types.includes("agrego_carrito"), "se registrÃ³ el agregado al carrito");

  step("El registro rechaza datos invÃ¡lidos");
  const bad = await fetch(`${BASE}/api/track`, { method: "POST", body: JSON.stringify({ type: "hackeo", aid, data: {} }) });
  assert(bad.status >= 400, `tipo desconocido rechazado (${bad.status})`);

  step("Carrito: sugerencias");
  await page.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="sugerencias"]', { timeout: 20000 });
  const sug = await page.$$eval('[data-testid="sugerencias"] li', (els) => els.length);
  assert(sug >= 1 && sug <= 3, `muestra ${sug} sugerencias`);
  const sugText = await page.$eval('[data-testid="sugerencias"]', (el) => el.innerText.toLowerCase());
  assert(!sugText.includes("caicedo"), "no sugiere lo que ya estÃ¡ en el carrito");
  await shot(page, "ventas-carrito");

  step("Checkout registra el inicio");
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await sleep(1500);
  const { data: ck } = await db.from("events").select("type").eq("data->>aid", aid).eq("type", "inicio_checkout");
  assert(ck?.length === 1, "se registrÃ³ una vez el inicio del checkout");

  step("Enlace 'Retomar mi compra' en otro dispositivo");
  const { data: order } = await db
    .from("orders")
    .select("id, order_items(quantity)")
    .eq("channel", "online")
    .not("order_items", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const withItems = (order ?? []).find((o) => o.order_items.length > 0);
  assert(!!withItems, "hay un pedido online para probar");
  const ctx = await browser.createBrowserContext();
  const p2 = await ctx.newPage();
  await p2.setUserAgent(UA);
  await p2.setViewport({ width: 1280, height: 900 });
  await p2.goto(`${BASE}/carrito/recuperar?pedido=${withItems.id}&origen=abandono`, { waitUntil: "networkidle0" });
  await p2.waitForFunction(() => location.pathname === "/carrito", { timeout: 20000 });
  const lines = await p2.evaluate(() => JSON.parse(localStorage.getItem("kaffa-cart-v1") ?? "[]").length);
  assert(lines === withItems.order_items.length, `el carrito se rearmÃ³ con ${lines} productos`);
  aids.add(await p2.evaluate(() => localStorage.getItem("kaffa-aid")));
  await shot(p2, "ventas-recuperado");
  await p2.goto(`${BASE}/carrito/recuperar?pedido=00000000-0000-0000-0000-000000000000`, { waitUntil: "networkidle0" });
  assert((await p2.evaluate(() => document.body.innerText)).includes("No encontramos ese pedido"), "un pedido inexistente muestra un aviso");
  await ctx.close();

  step("Baja con enlace firmado");
  const email = "prueba+baja@kaffalove.test";
  const secret = env.UNSUBSCRIBE_SECRET || env.SUPABASE_SECRET_KEY;
  const token = crypto.createHmac("sha256", secret).update(`baja:${email}`).digest("base64url").slice(0, 32);
  await page.goto(`${BASE}/novedades/baja?e=${encodeURIComponent(email)}&t=${token}`, { waitUntil: "networkidle0" });
  let txt = await page.evaluate(() => document.body.innerText);
  assert(txt.includes(email), "con firma vÃ¡lida muestra el correo listo para darse de baja");
  assert(!(await page.$('input[name="email"][type="email"]')), "no pide escribir el correo");
  await page.goto(`${BASE}/novedades/baja?e=${encodeURIComponent(email)}&t=firmafalsa`, { waitUntil: "networkidle0" });
  assert(!!(await page.$('input[name="email"][type="email"]')), "con firma invÃ¡lida pide el correo");

  console.log("\nTodo OK");
} catch (e) {
  await shot(page, "ventas-error").catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const aid of aids) if (aid) await db.from("events").delete().eq("data->>aid", aid);
  await browser.close();
}

