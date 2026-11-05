// Envía a los clientes migrados de PrestaShop un enlace para crear su contraseña
// en la nueva tienda. Requiere RESEND_API_KEY, EMAIL_FROM y NEXT_PUBLIC_SITE_URL.
//
//   node scripts/prestashop/enviar-bienvenida.mjs            (simulación: lista destinatarios)
//   node scripts/prestashop/enviar-bienvenida.mjs --enviar   (envía)
//
// Solo escribe a clientes de PrestaShop sin cuenta en la nueva tienda. Envía de a uno,
// con pausa, para no saturar el correo.
import { adminDb, loadEnv } from "../e2e/db.mjs";

const env = { ...loadEnv(), ...process.env };
const send = process.argv.includes("--enviar");
const site = (env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
if (send && (!env.RESEND_API_KEY || !env.EMAIL_FROM || !site.startsWith("https://"))) {
  console.error("Faltan RESEND_API_KEY, EMAIL_FROM o NEXT_PUBLIC_SITE_URL (https).");
  process.exit(1);
}

const db = adminDb();
const { data: customers } = await db.from("customers").select("email, name").eq("source", "prestashop").is("auth_user_id", null);
console.log(`${customers.length} clientes migrados sin cuenta.`);
if (!send) {
  customers.forEach((c) => console.log(`  ${c.email}`));
  console.log("Simulación. Agrega --enviar para mandar los correos.");
  process.exit(0);
}

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let ok = 0;
for (const c of customers) {
  await db.auth.admin.createUser({ email: c.email, email_confirm: true }).catch(() => null);
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: c.email });
  if (error) { console.error(`${c.email}: ${error.message}`); continue; }
  const link = `${site}/cuenta/nueva-clave?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
  const first = c.name?.split(" ")[0];
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1d1511">
<p style="font-family:Georgia,serif;font-size:22px">Kaffa <i>Love</i></p>
<h1 style="font-family:Georgia,serif;font-weight:normal">${first ? `${esc(first)}, e` : "E"}strenamos tienda</h1>
<p>Renovamos la tienda de Kaffa Love. Por seguridad, las contraseñas anteriores no se traspasaron: crea una nueva para ver tus pedidos y comprar más rápido.</p>
<p style="margin:24px 0"><a href="${link}" style="background:#b4432c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Crear contraseña</a></p>
<p style="color:#8b7c70;font-size:13px">El enlace vence en 24 horas. Si no quieres crear una cuenta, ignora este correo: puedes seguir comprando sin cuenta.</p></div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: c.email, subject: "Estrenamos tienda: crea tu contraseña", html }),
  });
  if (res.ok) ok++;
  else console.error(`${c.email}: ${res.status} ${await res.text()}`);
  await new Promise((r) => setTimeout(r, 600));
}
console.log(`Enviados: ${ok} de ${customers.length}.`);
