"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomer, sendPasswordLink } from "@/lib/customer-auth";
import { logEvent } from "@/lib/events";

const PAID = ["pagado", "en_preparacion", "despachado", "listo_retiro", "entregado"];

/** Crear contraseña justo después de comprar (desde la página del pedido) */
export async function createAccountFromOrder(_prev: string | null, form: FormData): Promise<string | null> {
  const orderId = String(form.get("orderId") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("status, paid_at, customer_id, customers (id, email, auth_user_id)").eq("id", orderId).maybeSingle();
  const customer = order?.customers as unknown as { id: string; email: string; auth_user_id: string | null } | null;
  // Solo para compras pagadas en las últimas 48 horas, con el enlace privado del pedido
  const recent = order?.paid_at && Date.parse(order.paid_at) > Date.now() - 48 * 3600_000;
  if (!order || !customer || !PAID.includes(order.status) || !recent) return "Esta opción ya no está disponible para este pedido.";
  if (customer.auth_user_id) return "Ya tienes una cuenta. Ingresa con tu correo y contraseña.";

  const { data: created, error } = await db.auth.admin.createUser({ email: customer.email, password, email_confirm: true });
  if (error) {
    return /already|registered|exists/i.test(error.message)
      ? "Ya existe una cuenta con este correo. Ingresa o recupera tu contraseña."
      : "No pudimos crear la cuenta. Intenta de nuevo.";
  }
  await db.from("customers").update({ auth_user_id: created.user.id }).eq("id", customer.id);
  await logEvent("cuenta_creada", "customer", customer.id);

  const auth = await createAuthClient();
  await auth.auth.signInWithPassword({ email: customer.email, password });
  redirect("/cuenta");
}

export async function customerSignIn(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const auth = await createAuthClient();
  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) return "Correo o contraseña incorrectos.";
  if (!(await getCustomer())) {
    await auth.auth.signOut();
    return "No encontramos compras asociadas a este correo.";
  }
  redirect("/cuenta");
}

export async function customerSignOut() {
  const auth = await createAuthClient();
  await auth.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) return "Ingresa tu correo.";
  const { data: customer } = await createAdminClient().from("customers").select("id").eq("email", email).maybeSingle();
  if (customer) await sendPasswordLink(email, "recuperar");
  // Misma respuesta siempre, para no revelar quién es cliente
  return "ok";
}

export async function setNewPassword(_prev: string | null, form: FormData): Promise<string | null> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  const auth = await createAuthClient();
  const { error } = await auth.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error) return "El enlace venció o ya se usó. Pide uno nuevo.";
  const { error: updateError } = await auth.auth.updateUser({ password });
  if (updateError) return "No pudimos guardar la contraseña. Intenta de nuevo.";
  if (!(await getCustomer())) {
    await auth.auth.signOut();
    return "Contraseña guardada, pero este correo no tiene compras en la tienda.";
  }
  redirect("/cuenta");
}

export async function setMarketingConsent(consent: boolean) {
  const customer = await getCustomer();
  if (!customer) return;
  await createAdminClient()
    .from("customers")
    .update({ marketing_consent: consent, marketing_consent_at: new Date().toISOString() })
    .eq("id", customer.id);
  refresh();
}
