// Prueba del pedido de reseñas: Configuración valida y guarda el enlace, y la
// tarea periódica lo ejecuta (en local no envía: solo producción envía).
// Al final deja el enlace como estaba. Requiere `npm run dev`.
import fs from "node:fs";
import { BASE, assert, clickText, launch, step } from "./lib.mjs";
import { adminDb, loadEnv } from "./db.mjs";

const db = adminDb();
const env = { ...loadEnv(), ...process.env };
const { browser, page } = await launch();
const settings = async () => JSON.parse(await (await db.storage.from("config").download("settings.json")).data.text());
const before = (await settings()).reviewUrl ?? "";

async function saveReviewUrl(url) {
  await page.goto(`${BASE}/admin/configuracion`, { waitUntil: "networkidle0" });
  const input = await page.$('input[name="reviewUrl"]');
  await input.evaluate((el, v) => {
    el.type = "text"; // permite probar un enlace inválido sin la validación del navegador
    el.value = v;
  }, url);
  await clickText(page, "button", "Guardar configuración");
  await page.waitForFunction(() => /Configuración guardada|debe empezar con https/.test(document.body.innerText), { timeout: 30000 });
  return page.evaluate(() => document.body.innerText);
}

try {
  step("Ingresar como administrador");
  const email = "e2e-admin@kaffalove.test";
  const pass = /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${email}.txt`, "utf8"))[1].trim();
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);

  step("Configuración valida el enlace");
  let txt = await saveReviewUrl("javascript:alert(1)");
  assert(txt.includes("debe empezar con https"), "rechaza un enlace que no es https");
  txt = await saveReviewUrl("https://g.page/r/prueba-e2e/review");
  assert(txt.includes("Configuración guardada"), "guarda un enlace https");
  assert((await settings()).reviewUrl === "https://g.page/r/prueba-e2e/review", "queda en la configuración");
  assert((await settings()).emailReview === true, "pedido de reseña activo");

  step("La tarea periódica incluye las reseñas (sin enviar fuera de producción)");
  if (!env.CRON_SECRET) {
    console.log("  (sin CRON_SECRET en .env.local: se omite; en Vercel la tarea responde reviewEmails)");
  } else {
    const res = await fetch(`${BASE}/api/cron/expirar-reservas`, { headers: { authorization: `Bearer ${env.CRON_SECRET}` } });
    const json = await res.json();
    assert(res.status === 200 && json.reviewEmails === 0, `responde reviewEmails=${json.reviewEmails}`);
  }

  console.log("\nTodo OK");
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await saveReviewUrl(before).catch(() => {});
  console.log(`(enlace restaurado: ${(await settings()).reviewUrl === before})`);
  await browser.close();
}
