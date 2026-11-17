// Envía a los clientes migrados de PrestaShop un enlace para crear su contraseña
// en la nueva tienda. Requiere RESEND_API_KEY, EMAIL_FROM y NEXT_PUBLIC_SITE_URL.
//
//   node scripts/prestashop/enviar-bienvenida.mjs                  (simulación: cuenta destinatarios)
//   node scripts/prestashop/enviar-bienvenida.mjs --vista out.html (guarda el correo de ejemplo, sin enviar)
//   node scripts/prestashop/enviar-bienvenida.mjs --enviar         (envía)
//
// Solo escribe a clientes de PrestaShop sin cuenta en la nueva tienda. Envía de a uno,
// con pausa, para no saturar el correo. Mismo texto que sendPasswordLink("bienvenida")
// en src/lib/customer-auth.ts.
import fs from "node:fs";
import { adminDb, loadEnv } from "../e2e/db.mjs";

const env = { ...loadEnv(), ...process.env };
const send = process.argv.includes("--enviar");
const previewIdx = process.argv.indexOf("--vista");
const previewFile = previewIdx > 0 ? process.argv[previewIdx + 1] : null;
const site = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
if (send && (!env.RESEND_API_KEY || !env.EMAIL_FROM || !site.startsWith("https://"))) {
  console.error("Faltan RESEND_API_KEY, EMAIL_FROM o NEXT_PUBLIC_SITE_URL (https).");
  process.exit(1);
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// PrestaShop guarda algunos nombres en mayúsculas: "MARÍA" → "María"
const firstName = (name) => {
  const w = name?.trim().split(/\s+/)[0];
  return w ? w.charAt(0).toLocaleUpperCase("es") + w.slice(1).toLocaleLowerCase("es") : null;
};

/** Igual que emailLayout() de src/lib/email.ts */
function emailHtml(name, link) {
  const first = firstName(name);
  const title = `${first ? `${esc(first)}, e` : "E"}strenamos tienda`;
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f0e7;font-family:Arial,Helvetica,sans-serif;color:#1d1511">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 24px"><img src="${site}/brand/logo-horizontal.png" alt="Kaffa Love" width="181" height="32" style="display:block;border:0;height:32px;width:181px"></p>
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:26px">${title}</h1>
<p>Renovamos la tienda de Kaffa Love en <a href="${site}" style="color:#387b4d">${site.replace(/^https?:\/\//, "")}</a>. Ahora puedes ver nuestros cafés con su ficha completa, encontrar recetas para prepararlos y seguir tus pedidos.</p>
<p>Por seguridad, las contraseñas anteriores no se traspasaron. Crea una nueva para entrar a tu cuenta:</p>
<p style="margin:24px 0"><a href="${link}" style="background:#387b4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Crear contraseña</a></p>
<p>En tu cuenta también puedes activar las novedades: nuevos cafés, recetas y promociones. Solo te escribiremos si las activas.</p>
<p style="color:#8b7c70;font-size:13px">Si el botón ya no funciona, pide un enlace nuevo en <a href="${site}/cuenta/recuperar" style="color:#8b7c70">${site.replace(/^https?:\/\//, "")}/cuenta/recuperar</a>. Si no quieres una cuenta, ignora este correo: puedes seguir comprando sin ella.</p>
</td></tr></table>
<p style="font-size:12px;color:#8b7c70;margin-top:16px">Kaffa Love · Café de especialidad</p>
</td></tr></table></body></html>`;
}
const SUBJECT = "Estrenamos tienda: crea tu contraseña";

if (previewFile) {
  fs.writeFileSync(previewFile, emailHtml("MARÍA JOSÉ", `${site}/cuenta/nueva-clave?token_hash=EJEMPLO`));
  console.log(`Vista previa guardada en ${previewFile} (asunto: "${SUBJECT}").`);
  process.exit(0);
}

const db = adminDb();
const { data: all } = await db.from("customers").select("id, email, name").eq("source", "prestashop").is("auth_user_id", null);
// La tienda también lo envía de forma programada (src/lib/welcome-migrated.ts): nunca dos veces
const { data: sent } = await db.from("events").select("entity_id").eq("type", "bienvenida_enviada").in("entity_id", all.map((c) => c.id));
const done = new Set((sent ?? []).map((e) => e.entity_id));
const customers = all.filter((c) => !done.has(c.id));
console.log(`${customers.length} clientes migrados sin cuenta y sin bienvenida (${done.size} ya la recibieron).`);
if (!send) {
  console.log("Simulación. Agrega --enviar para mandar los correos (o --vista archivo.html para ver el texto).");
  process.exit(0);
}

let ok = 0;
for (const c of customers) {
  await db.auth.admin.createUser({ email: c.email, email_confirm: true }).catch(() => null);
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: c.email });
  if (error) { console.error(`${c.email}: ${error.message}`); continue; }
  const link = `${site}/cuenta/nueva-clave?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: c.email, subject: SUBJECT, html: emailHtml(c.name, link) }),
  });
  if (res.ok) {
    ok++;
    await db.from("events").insert({ type: "bienvenida_enviada", entity: "customer", entity_id: c.id, data: { origen: "prestashop", via: "script" } });
  } else console.error(`${c.email}: ${res.status} ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 600));
}
console.log(`Enviados: ${ok} de ${customers.length}.`);
