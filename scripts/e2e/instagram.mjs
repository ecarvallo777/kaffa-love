// Prueba de publicación en Instagram desde Admin → Marketing, contra un Instagram simulado:
// conectar la cuenta, subir una foto propia + una del catálogo como carrusel y publicar ya,
// programar una publicación del plan semanal y cancelarla, y publicar ahora desde la cola.
// Requiere `npm run dev` iniciado con INSTAGRAM_API_URL=http://localhost:4599.
// No corre si ya hay una cuenta real conectada. Al final deja todo como estaba.
import fs from "node:fs";
import { BASE, assert, clickText, launch, shot, step } from "./lib.mjs";
import { adminDb } from "./db.mjs";
import { IG_USERNAME, startInstagramSimulado } from "./instagram-simulado.mjs";

const db = adminDb();
const config = db.storage.from("config");
const readJson = async (file, fallback) => {
  const { data, error } = await config.download(file);
  return error ? fallback : JSON.parse(await data.text());
};
const writeJson = (file, value) => config.upload(file, new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }), { upsert: true });

if (await readJson("clave-instagram.json", null)) {
  console.log("Ya hay una cuenta de Instagram conectada: la prueba no corre para no reemplazarla.");
  process.exit(1);
}
const queueBefore = await readJson("instagram.json", null);
const runsBefore = await readJson("marketing.json", []);
const startedAt = new Date().toISOString();

const sim = await startInstagramSimulado();
const { browser, page } = await launch();
page.on("dialog", (d) => d.accept());
const testIds = [];

async function queue() {
  return readJson("instagram.json", []);
}

try {
  step("Ingresar como administrador");
  const admin = "e2e-admin@kaffalove.test";
  const pass = /Contraseña: (.+)/.exec(fs.readFileSync(`.credenciales-${admin}.txt`, "utf8"))[1].trim();
  await page.goto(`${BASE}/ingresar`, { waitUntil: "networkidle0" });
  await page.type('input[name="email"]', admin);
  await page.type('input[name="password"]', pass);
  await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("button")]);

  step("Conectar Instagram con el token");
  await page.goto(`${BASE}/admin/marketing`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.type('input[name="token"]', "IGAA" + "x".repeat(60));
  await clickText(page, "button", "Conectar");
  await page.waitForFunction((u) => document.body.innerText.includes(`Conectado como @${u}`), { timeout: 30000 }, IG_USERNAME);
  assert(true, `conectado como @${IG_USERNAME}`);
  const stored = await readJson("clave-instagram.json", null);
  assert(stored?.userId && stored.token.startsWith("IGAA"), "token guardado en config/clave-instagram.json");

  step("Carrusel: foto propia (PNG horizontal) + foto del catálogo, publicar ahora");
  await page.goto(`${BASE}/admin/marketing/instagram/nueva`, { waitUntil: "networkidle0", timeout: 90000 });
  const input = await page.$('input[type="file"]');
  await input.uploadFile("public/brand/logo-original-canva.png");
  await page.waitForFunction(() => document.body.innerText.includes("Fotos y videos (1)"));
  await page.$eval("details summary", (el) => el.click());
  await page.$eval("details button", (el) => el.click());
  await page.waitForFunction(() => document.body.innerText.includes("Fotos y videos (2)"));
  await page.type("textarea", "Prueba de carrusel #kaffalove");
  await clickText(page, "label", "Publicar ahora");
  await shot(page, "instagram-editor");
  await clickText(page, "button", "Publicar en @");
  await page.waitForFunction(() => location.search.includes("ig=") || document.querySelector('[role="alert"]'), { timeout: 120000 });
  const alert = await page.$eval('[role="alert"]', (el) => el.textContent).catch(() => null);
  assert(!alert, `sin errores en el editor${alert ? `: ${alert}` : ""}`);
  assert(decodeURIComponent(page.url()).includes("¡Publicado en Instagram!"), "vuelve a Marketing con «¡Publicado en Instagram!»");

  const creates = sim.log.filter((l) => l.create);
  const kids = creates.filter((l) => l.is_carousel_item);
  assert(kids.length === 2 && kids.every((k) => k.size && Math.abs(k.size.width / k.size.height - 0.8) < 0.01), "2 elementos JPG recortados a 4:5");
  const carousel = creates.find((l) => l.media_type === "CAROUSEL");
  assert(carousel?.caption === "Prueba de carrusel #kaffalove" && carousel.children.split(",").length === 2, "carrusel con el texto y sus 2 elementos");
  assert(sim.log.filter((l) => l.publish).length === 1, "una sola publicación");
  let q = await queue();
  const first = q.find((p) => p.createdAt >= startedAt && p.status === "publicada");
  testIds.push(...q.filter((p) => p.createdAt >= startedAt).map((p) => p.id));
  assert(first?.permalinks?.[0]?.includes("instagram.com/p/"), `queda publicada con enlace ${first?.permalinks?.[0]}`);
  const { data: left } = await db.storage.from("instagram").list("media", { search: first.media[0].path.slice(6) });
  assert(!left?.length, "las fotos subidas se borraron después de publicar");
  await page.waitForFunction(() => document.body.innerText.includes("Publicadas"));
  await shot(page, "instagram-marketing");

  const run = runsBefore[0];
  if (run?.posts?.length) {
    step("Programar una publicación del plan y cancelarla");
    await page.goto(`${BASE}/admin/marketing/instagram/nueva?plan=${run.id}&post=0`, { waitUntil: "networkidle0", timeout: 90000 });
    const caption = await page.$eval("textarea", (el) => el.value).catch(() => "");
    assert(caption.startsWith(run.posts[0].caption.slice(0, 30)), "el texto del plan viene precargado");
    await (await page.$('input[type="file"]')).uploadFile("public/brand/logo-original-canva.png");
    await page.waitForFunction(() => document.body.innerText.includes("Fotos y videos (1)"));
    if (run.posts[0].format === "reel") await clickText(page, "label", "Publicación");
    await clickText(page, "button", "Programar publicación");
    await page.waitForFunction(() => location.search.includes("ig="), { timeout: 60000 });
    assert(decodeURIComponent(page.url()).includes("Programada para el"), "queda programada");
    q = await queue();
    const scheduled = q.find((p) => p.source?.runId === run.id && p.status === "programada");
    testIds.push(scheduled.id);
    assert(new Date(scheduled.scheduledAt) > new Date(), "fecha futura (mañana 19:00)");
    assert(await page.evaluate(() => document.body.innerText.includes("Programada ")), "el post del plan muestra «Programada»");
    await clickText(page, "button", "Cancelar");
    await page.waitForFunction(() => document.body.innerText.includes("Publicación cancelada"), { timeout: 30000 });
    q = await queue();
    assert(q.find((p) => p.id === scheduled.id)?.status === "cancelada", "cancelada");
    const runsNow = await readJson("marketing.json", []);
    assert(runsNow[0].posts[0].status === run.posts[0].status, "el post del plan no cambió de estado");
  }

  step("Historia programada → «Publicar ahora» desde la cola");
  await page.goto(`${BASE}/admin/marketing/instagram/nueva`, { waitUntil: "networkidle0", timeout: 90000 });
  await clickText(page, "label", "Historias");
  await (await page.$('input[type="file"]')).uploadFile("public/brand/logo-original-canva.png");
  await page.waitForFunction(() => document.body.innerText.includes("Fotos y videos (1)"));
  await clickText(page, "button", "Programar publicación");
  await page.waitForFunction(() => location.search.includes("ig="), { timeout: 60000 });
  q = await queue();
  const story = q.find((p) => p.kind === "historia" && p.status === "programada" && p.createdAt >= startedAt);
  testIds.push(story.id);
  await clickText(page, "button", "Publicar ahora");
  await page.waitForFunction(() => document.body.innerText.includes("¡Publicado en Instagram!"), { timeout: 60000 });
  const storyCreate = sim.log.filter((l) => l.media_type === "STORIES").at(-1);
  assert(storyCreate?.size?.width === 1080 && storyCreate.size.height === 1920, "historia en 1080×1920");
  q = await queue();
  assert(q.find((p) => p.id === story.id)?.status === "publicada", "historia publicada");

  step("Reel con video (MP4 simulado): espera a que Instagram lo procese y publica");
  const fakeVideo = `${process.env.TEMP ?? "."}/kaffa-reel-prueba.mp4`;
  fs.writeFileSync(fakeVideo, Buffer.alloc(300 * 1024, 7));
  await page.goto(`${BASE}/admin/marketing/instagram/nueva`, { waitUntil: "networkidle0", timeout: 90000 });
  await clickText(page, "label", "Reel");
  await (await page.$('input[type="file"]')).uploadFile(fakeVideo);
  await page.waitForFunction(() => document.body.innerText.includes("Fotos y videos (1)"));
  await page.type("textarea", "Prueba de reel");
  await clickText(page, "label", "Publicar ahora");
  await clickText(page, "button", "Publicar en @");
  await page.waitForFunction(() => location.search.includes("ig=") || document.querySelector('[role="alert"]'), { timeout: 120000 });
  assert(decodeURIComponent(page.url()).includes("¡Publicado en Instagram!"), "reel publicado");
  const reel = sim.log.filter((l) => l.media_type === "REELS").at(-1);
  assert(reel?.video_url?.endsWith(".mp4") && reel.share_to_feed === "true" && reel.caption === "Prueba de reel", "contenedor REELS con video, texto y share_to_feed");
  fs.rmSync(fakeVideo);

  step("Token inválido se rechaza");
  await clickText(page, "button", "Desconectar Instagram");
  await page.waitForFunction(() => document.body.innerText.includes("Instagram desconectado"), { timeout: 30000 });
  await page.type('input[name="token"]', "malo" + "x".repeat(60));
  await clickText(page, "button", "Conectar");
  await page.waitForFunction(() => document.body.innerText.includes("Cannot parse access token"), { timeout: 30000 });
  assert(true, "token inválido rechazado con mensaje");

  step("Token de Facebook (EAA…): sin clave secreta se pide; con ella queda de 60 días y publica");
  await page.goto(`${BASE}/admin/marketing`, { waitUntil: "networkidle0", timeout: 90000 });
  await page.type('input[name="token"]', "EAAcorto" + "z".repeat(60));
  await clickText(page, "button", "Conectar");
  await page.waitForFunction(() => document.body.innerText.includes("Clave secreta de la app»"), { timeout: 30000 });
  assert(true, "token corto sin clave: pide la clave secreta");
  await page.type('input[name="appSecret"]', "secreto-de-prueba");
  await clickText(page, "button", "Conectar");
  await page.waitForFunction((u) => document.body.innerText.includes(`Conectado como @${u}`), { timeout: 30000 }, IG_USERNAME);
  const fbStore = await readJson("clave-instagram.json", null);
  assert(fbStore.host === "facebook" && fbStore.token.startsWith("EAAlargo") && fbStore.appSecret, "token cambiado por uno de 60 días, con renovación");
  assert(await page.evaluate(() => document.body.innerText.includes("El acceso se renueva solo")), "muestra que se renueva solo");
  await page.goto(`${BASE}/admin/marketing/instagram/nueva`, { waitUntil: "networkidle0", timeout: 90000 });
  await (await page.$('input[type="file"]')).uploadFile("public/brand/logo-original-canva.png");
  await page.waitForFunction(() => document.body.innerText.includes("Fotos y videos (1)"));
  await page.type("textarea", "Prueba con token de Facebook");
  await clickText(page, "label", "Publicar ahora");
  await clickText(page, "button", "Publicar en @");
  await page.waitForFunction(() => location.search.includes("ig=") || document.querySelector('[role="alert"]'), { timeout: 120000 });
  assert(decodeURIComponent(page.url()).includes("¡Publicado en Instagram!"), "publica con el token de Facebook");

  step("Token de Unified login: sin ID de la app lo pide; con el ID conecta");
  await page.goto(`${BASE}/admin/marketing`, { waitUntil: "networkidle0", timeout: 90000 });
  await clickText(page, "button", "Desconectar Instagram");
  await page.waitForFunction(() => document.body.innerText.includes("Instagram desconectado"), { timeout: 30000 });
  await page.type('input[name="token"]', "EAAunif" + "u".repeat(60));
  await page.type('input[name="appSecret"]', "secreto-de-prueba");
  await clickText(page, "button", "Conectar");
  await page.waitForFunction(() => document.body.innerText.includes("«ID de la app»"), { timeout: 30000 });
  assert(true, "sin ID: pide el «ID de la app»");
  await page.type('input[name="appId"]', "123456");
  await clickText(page, "button", "Conectar");
  await page.waitForFunction((u) => document.body.innerText.includes(`Conectado como @${u}`), { timeout: 30000 }, IG_USERNAME);
  const unif = await readJson("clave-instagram.json", null);
  assert(unif.host === "facebook" && unif.token.startsWith("EAAlargoU") && unif.appId === "123456" && unif.userId === "17890000000000001", "con el ID: token de 60 días y la cuenta tomada de los permisos del token (sin permiso de páginas)");
  console.log("\nTodo OK");
} catch (e) {
  console.error(e.message);
  await shot(page, "instagram-error").catch(() => {});
  process.exitCode = 1;
} finally {
  // Dejar todo como estaba
  await config.remove(["clave-instagram.json"]);
  if (queueBefore) await writeJson("instagram.json", queueBefore);
  else await config.remove(["instagram.json"]);
  const q = await queue();
  const media = (await db.storage.from("instagram").list("media", { limit: 1000 })).data ?? [];
  const keep = new Set(q.flatMap((p) => p.media.map((m) => m.path)));
  const extra = media.filter((f) => !keep.has(`media/${f.name}`) && f.created_at >= startedAt).map((f) => `media/${f.name}`);
  if (extra.length) await db.storage.from("instagram").remove(extra);
  await db.from("events").delete().like("type", "instagram_%").gte("created_at", startedAt);
  console.log(`Limpieza: ${testIds.length} publicaciones de prueba, ${extra.length} archivos, eventos instagram_* de la prueba.`);
  await browser.close();
  sim.close();
}
