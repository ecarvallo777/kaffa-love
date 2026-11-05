"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { closeSession, openSession, registerFairSale, voidFairSale, type FairSaleResult } from "@/lib/fair";
import type { LineInput } from "@/lib/orders";

const ROLES = ["admin", "operador"] as const;

export async function openSessionAction(_prev: string | null, form: FormData): Promise<string | null> {
  const staff = await requireStaff([...ROLES], "/feria");
  const name = String(form.get("name") ?? "").trim();
  if (!name) return "Ponle un nombre a la jornada (ej.: Feria Parque Bustamante).";
  const preparados = [...form.entries()]
    .filter(([k]) => k.startsWith("prep_"))
    .map(([k, v]) => ({ productId: k.slice(5), qty: Number(v) }))
    .filter((p) => Number.isInteger(p.qty) && p.qty >= 0);
  try {
    await openSession({ name, location: String(form.get("location") ?? "").trim(), preparados, userId: staff.userId, email: staff.email });
  } catch (e) {
    return (e as Error).message;
  }
  redirect("/feria");
}

export async function sellAction(sessionId: string, lines: LineInput[]): Promise<FairSaleResult> {
  const staff = await requireStaff([...ROLES], "/feria");
  const res = await registerFairSale(sessionId, lines, staff.email);
  refresh();
  return res;
}

export async function voidSaleAction(orderId: string): Promise<string | null> {
  const staff = await requireStaff([...ROLES], "/feria");
  try {
    await voidFairSale(orderId, staff.email);
    refresh();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function closeSessionAction(_prev: string | null, form: FormData): Promise<string | null> {
  const staff = await requireStaff([...ROLES], "/feria");
  const sessionId = String(form.get("sessionId"));
  const raw = String(form.get("pointTotal") ?? "").replace(/[.$\s]/g, "");
  const pointTotal = raw ? Number(raw) : null;
  if (pointTotal !== null && (!Number.isInteger(pointTotal) || pointTotal < 0)) return "El total de Point no es válido.";
  try {
    await closeSession(sessionId, pointTotal, String(form.get("notes") ?? "").trim(), staff.email);
  } catch (e) {
    return (e as Error).message;
  }
  redirect(`/feria/cierre/${sessionId}`);
}
