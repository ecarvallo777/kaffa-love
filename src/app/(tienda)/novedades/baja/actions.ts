"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";

export async function unsubscribe(_prev: string | null, form: FormData): Promise<string> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Ingresa un correo válido.";
  const { data } = await createAdminClient()
    .from("customers")
    .update({ marketing_consent: false, marketing_consent_at: new Date().toISOString() })
    .eq("email", email)
    .select("id");
  if (data?.[0]) await logEvent("baja_novedades", "customer", data[0].id);
  // Misma respuesta exista o no el correo, para no revelar quién es cliente
  return "ok";
}
