"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { getStaff } from "@/lib/auth";

export async function signIn(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "");
  if (!email || !password) return "Ingresa tu correo y contraseña.";

  const auth = await createAuthClient();
  const { error } = await auth.auth.signInWithPassword({ email, password });
  if (error) return "Correo o contraseña incorrectos.";

  const staff = await getStaff();
  if (!staff) {
    await auth.auth.signOut();
    return "Tu usuario no pertenece al equipo de Kaffa Love.";
  }

  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  redirect(safeNext || (staff.role === "admin" ? "/admin" : "/feria"));
}

export async function signOut() {
  const auth = await createAuthClient();
  await auth.auth.signOut();
  redirect("/ingresar");
}
