"use server";

import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/components/admin/action-form";

export async function addMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const role = form.get("role") === "admin" ? "admin" : "operador";
  const password = String(form.get("password") ?? "");
  if (!email.includes("@") || !name) return { error: "Completa nombre y correo." };
  if (password.length < 10) return { error: "La contraseña inicial debe tener al menos 10 caracteres." };

  const db = createAdminClient();
  const { data: created, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  let userId = created?.user?.id;
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) return { error: error.message };
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return { error: "El usuario ya existe pero no se pudo encontrar." };
  }
  const { error: staffError } = await db.from("staff").upsert({ user_id: userId, name, role });
  if (staffError) return { error: staffError.message };
  refresh();
  return { ok: `${name} puede ingresar en /ingresar con su correo y la contraseña indicada.` };
}

export async function updateMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireStaff(["admin"]);
  const userId = String(form.get("userId"));
  const op = String(form.get("op"));
  const db = createAdminClient();

  if (op === "remove") {
    if (userId === me.userId) return { error: "No puedes quitarte a ti mismo." };
    await db.from("staff").delete().eq("user_id", userId);
    await db.auth.admin.deleteUser(userId);
    refresh();
    return { ok: "Acceso eliminado." };
  }
  if (op === "password") {
    const password = String(form.get("password") ?? "");
    if (password.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };
    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) return { error: error.message };
    return { ok: "Contraseña actualizada." };
  }
  if (op === "role") {
    if (userId === me.userId) return { error: "No puedes cambiar tu propio rol." };
    const role = form.get("role") === "admin" ? "admin" : "operador";
    await db.from("staff").update({ role }).eq("user_id", userId);
    refresh();
    return { ok: "Rol actualizado." };
  }
  return { error: "Acción desconocida." };
}
