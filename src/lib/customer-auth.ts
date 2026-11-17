import "server-only";
import { createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";

export type Customer = { id: string; email: string; name: string | null; marketing_consent: boolean };

/**
 * Cliente con sesión iniciada. Si la cuenta se creó desde un enlace de
 * bienvenida o recuperación, se vincula por correo la primera vez.
 */
export async function getCustomer(): Promise<Customer | null> {
  const auth = await createAuthClient();
  const { data } = await auth.auth.getClaims();
  const sub = data?.claims?.sub;
  const email = String(data?.claims?.email ?? "").toLowerCase();
  if (!sub) return null;

  const db = createAdminClient();
  const { data: linked } = await db.from("customers").select("id, email, name, marketing_consent").eq("auth_user_id", sub).maybeSingle();
  if (linked) return linked;
  if (!email) return null;

  const { data: byEmail } = await db
    .from("customers")
    .update({ auth_user_id: sub })
    .eq("email", email)
    .is("auth_user_id", null)
    .select("id, email, name, marketing_consent")
    .maybeSingle();
  return byEmail ?? null;
}

export type SavedAddress = {
  id: string;
  street: string;
  number: string | null;
  apartment: string | null;
  commune: string;
  region: string;
  notes: string | null;
};

export type CustomerProfile = {
  email: string;
  name: string;
  phone: string;
  addresses: SavedAddress[];
};

/** Datos para completar el checkout de un cliente con sesión (direcciones sin repetir, la más reciente primero) */
export async function getCustomerProfile(): Promise<CustomerProfile | null> {
  const customer = await getCustomer();
  if (!customer) return null;
  const db = createAdminClient();
  const [{ data: full }, { data: addresses }] = await Promise.all([
    db.from("customers").select("phone").eq("id", customer.id).single(),
    db
      .from("addresses")
      .select("id, street, number, apartment, commune, region, notes")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const seen = new Set<string>();
  const unique = (addresses ?? []).filter((a) => {
    const key = addressKey(a);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { email: customer.email, name: customer.name ?? "", phone: full?.phone ?? "", addresses: unique.slice(0, 5) };
}

export const addressKey = (a: { street: string; number: string | null; apartment: string | null; commune: string; region: string }) =>
  [a.street, a.number ?? "", a.apartment ?? "", a.commune, a.region].map((s) => s.trim().toLowerCase()).join("|");

function passwordParts(link: string) {
  const site = siteUrl();
  const domain = site.replace(/^https?:\/\//, "");
  return {
    site,
    domain,
    button: `<p style="margin:24px 0"><a href="${link}" style="background:#387b4d;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Crear contraseña</a></p>`,
    renew: `Si el botón ya no funciona, pide un enlace nuevo en <a href="${site}/cuenta/recuperar" style="color:#8b7c70">${domain}/cuenta/recuperar</a>.`,
  };
}

/** Correo "Estrenamos tienda" para clientes migrados. Mismo texto que scripts/prestashop/enviar-bienvenida.mjs */
export function welcomeEmail(first: string | null, link: string) {
  const { site, domain, button, renew } = passwordParts(link);
  return {
    subject: "Estrenamos tienda: crea tu contraseña",
    html: emailLayout(
      `${first ? `${first}, e` : "E"}strenamos tienda`,
      `<p>Renovamos la tienda de Kaffa Love en <a href="${site}" style="color:#387b4d">${domain}</a>. Ahora puedes ver nuestros cafés con su ficha completa, encontrar recetas para prepararlos y seguir tus pedidos.</p>
<p>Por seguridad, las contraseñas anteriores no se traspasaron. Crea una nueva para entrar a tu cuenta:</p>
${button}
<p>En tu cuenta también puedes activar las novedades: nuevos cafés, recetas y promociones. Solo te escribiremos si las activas.</p>
<p style="color:#8b7c70;font-size:13px">${renew} Si no quieres una cuenta, ignora este correo: puedes seguir comprando sin ella.</p>`,
    ),
  };
}

/** Envía un enlace para crear o cambiar la contraseña (requiere Resend) */
export async function sendPasswordLink(email: string, kind: "recuperar" | "bienvenida") {
  const db = createAdminClient();
  const normalized = email.trim().toLowerCase();

  // Para clientes migrados que aún no tienen usuario
  if (kind === "bienvenida") {
    await db.auth.admin.createUser({ email: normalized, email_confirm: true }).catch(() => null);
  }
  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: normalized });
  if (error || !data.properties?.hashed_token) return false;

  const link = `${siteUrl()}/cuenta/nueva-clave?token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
  const { data: customer } = await db.from("customers").select("name").eq("email", normalized).maybeSingle();
  // PrestaShop guarda algunos nombres en mayúsculas: "MARÍA" → "María"
  const word = customer?.name?.trim().split(/\s+/)[0];
  const first = word ? word.charAt(0).toLocaleUpperCase("es") + word.slice(1).toLocaleLowerCase("es") : null;
  const { button, renew } = passwordParts(link);

  if (kind === "bienvenida") return sendEmail({ to: normalized, ...welcomeEmail(first, link) });

  return sendEmail({
    to: normalized,
    subject: "Cambia tu contraseña de Kaffa Love",
    html: emailLayout(
      "Crea una nueva contraseña",
      `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta. Si no fuiste tú, ignora este correo.</p>${button}<p style="color:#8b7c70;font-size:13px">${renew}</p>`,
    ),
  });
}
