import "server-only";
import { createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, escapeHtml, sendEmail } from "@/lib/email";
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
  const first = customer?.name?.split(" ")[0];
  const title = kind === "bienvenida" ? `${first ? `${escapeHtml(first)}, ` : ""}estrenamos tienda` : "Crea una nueva contraseña";
  const body =
    kind === "bienvenida"
      ? `<p>Renovamos la tienda de Kaffa Love. Por seguridad, las contraseñas anteriores no se traspasaron: crea una nueva para ver tus pedidos y comprar más rápido.</p>`
      : `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta. Si no fuiste tú, ignora este correo.</p>`;

  return sendEmail({
    to: normalized,
    subject: kind === "bienvenida" ? "Estrenamos tienda: crea tu contraseña" : "Cambia tu contraseña de Kaffa Love",
    html: emailLayout(
      title,
      `${body}<p style="margin:24px 0"><a href="${link}" style="background:#b4432c;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none">Crear contraseña</a></p><p style="color:#8b7c70;font-size:13px">El enlace vence en 24 horas.</p>`,
    ),
  });
}
