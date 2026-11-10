// Prueba del canal de llegada: un visitante entra por el QR de feria
// (?utm_source=feria), compra, y Reportes muestra la venta en «Feria (QR)».
// Requiere `npm run dev` con pago simulado. Después: node scripts/e2e/limpiar.mjs
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, sleep, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";

const db = adminDb();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());
// El registro ignora navegadores "Headless" (bots): se usa un agente de usuario normal
await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0");
let aid = null;

try {
  step("Entrar por el QR de feria y navegar sin la etiqueta");
  await page.goto(`${BASE}/?utm_source=feria&utm_medium=qr`, { waitUntil: "networkidle0" });
  await page.evaluate(() => localStorage.removeItem("kaffa-cart-v1"));
  await page.goto(`${BASE}/producto/caicedo-blend-colombia`, { waitUntil: "networkidle0" });
  const src = await page.evaluate(() => JSON.parse(localStorage.getItem("kaffa-src") ?? "null")?.s);
  assert(src === "feria", "el navegador recuerda el canal «feria»");
  await clickText(page, "#molienda label", "Media");
  await clickText(page, "button", "Agregar al carrito");
  await page.waitForSelector('[role="status"]');
  aid = await page.evaluate(() => localStorage.getItem("kaffa-aid"));
  let ev = [];
  for (let i = 0; i < 20 && !ev.length; i++) {
    ({ data: ev } = await db.from("events").select("data").eq("type", "vista_producto").eq("data->>aid", aid));
    if (!ev?.length) await sleep(500);
  }
  assert(ev?.[0]?.data?.fuente === "feria", "la vista del producto quedó con el canal");

  step("Entrar después desde la tienda misma no borra el canal");
  await page.goto(`${BASE}/carrito`, { waitUntil: "networkidle0" });
  assert((await page.evaluate(() => JSON.parse(localStorage.getItem("kaffa-src") ?? "null")?.s)) === "feria", "sigue en «feria»");

  step("Comprar con retiro y pagar (simulado)");
  await page.goto(`${BASE}/checkout`, { waitUntil: "networkidle0" });
  await page.type('input[type="email"]', "prueba+canal@kaffalove.test");
  await page.type('input[autocomplete="name"]', "Prueba Canal");
  await page.type('input[type="tel"]', "+56 9 8765 4321");
  await clickText(page, "button", "Pagar");
  await page.waitForFunction(() => location.pathname.startsWith("/dev/pago-simulado/"), { timeout: 30000 });
  const orderId = page.url().split("/").pop().split("?")[0];
  const { data: created } = await db.from("events").select("data").eq("type", "pedido_creado").eq("entity_id", orderId).single();
  assert(created.data.fuente === "feria", "el pedido guardó el canal «feria»");
  await clickText(page, "button", "Aprobar pago");
  await page.waitForFunction(() => document.body.textContent.includes("aprobado"), { timeout: 20000 });

  step("Reportes muestra la venta por canal");
  const email = "e2e-admin@kaffalove.test";
  const pass = /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${email}.txt`, "utf8"))[1].trim();
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);
  await page.goto(`${BASE}/admin/reportes`, { waitUntil: "networkidle0" });
  await page.waitForSelector('[data-testid="canales"]', { timeout: 30000 });
  const row = await page.$$eval('[data-testid="canales"] tbody tr', (trs) =>
    trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.trim())).find((c) => c[0] === "Feria (QR)"),
  );
  assert(row && Number(row[1]) >= 1 && Number(row[2]) >= 1, `fila Feria (QR): ${row?.join(" · ")}`);
  await shot(page, "canales-reportes");

  step("La etiqueta inválida se ignora");
  const bad = await fetch(`${BASE}/api/track`, {
    method: "POST",
    headers: { "user-agent": "Mozilla/5.0 Edg/130.0" },
    body: JSON.stringify({ type: "vista_producto", aid, data: { fuente: "<script>" } }),
  });
  assert(bad.status === 204, "se acepta el evento sin el canal inválido");

  console.log("\nTodo OK");
} catch (e) {
  await shot(page, "canales-error").catch(() => {});
  console.error(e);
  process.exitCode = 1;
} finally {
  if (aid) await db.from("events").delete().eq("data->>aid", aid);
  await browser.close();
}
