"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/components/admin/action-form";

export async function savePickup(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const id = String(form.get("id") ?? "");
  const row = {
    name: String(form.get("name") ?? "").trim(),
    address: String(form.get("address") ?? "").trim(),
    hours: String(form.get("hours") ?? "").trim(),
    active: form.get("active") === "on",
  };
  if (!row.name || !row.address || !row.hours) return { error: "Completa nombre, dirección y horario." };
  const db = createAdminClient();
  const { error } = id ? await db.from("pickup_locations").update(row).eq("id", id) : await db.from("pickup_locations").insert(row);
  if (error) return { error: error.message };
  updateTag("pickup");
  refresh();
  return { ok: id ? "Lugar actualizado." : "Lugar agregado." };
}
