"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/admin/action-form";
import { applyPurchase, getPurchase, removePurchase, setPurchaseStatus, syncDriveInvoices, type ApplyLine } from "@/lib/purchases";

export async function syncNow(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  try {
    const r = await syncDriveInvoices(2);
    if (!r.configured) return { error: "Falta configurar la conexión con Google Drive o la clave de Claude." };
    refresh();
    if (!r.read) return { ok: "No hay facturas nuevas en la carpeta." };
    return { ok: `Se leyeron ${r.read} factura(s).${r.waiting ? ` Quedan ${r.waiting}: vuelve a revisar en un momento.` : ""}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function confirmPurchase(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const id = String(form.get("id") ?? "");
  let lines: ApplyLine[];
  try {
    lines = JSON.parse(String(form.get("lines") ?? "[]")) as ApplyLine[];
  } catch {
    return { error: "No se pudo leer la revisión." };
  }
  try {
    await applyPurchase(id, lines, staff);
  } catch (e) {
    refresh();
    return { error: (e as Error).message };
  }
  updateTag("catalog");
  redirect(`/admin/compras?aplicada=${encodeURIComponent(id)}`);
}

export async function discardPurchase(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  try {
    await setPurchaseStatus(String(form.get("id") ?? ""), "descartada");
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect("/admin/compras");
}

/** Olvida la lectura para que la factura se vuelva a leer desde Drive */
export async function retryPurchase(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const p = await getPurchase(String(form.get("id") ?? ""));
  if (!p || p.status === "aplicada") return { error: "Esta factura ya se aplicó." };
  await removePurchase(p.id);
  return syncNow();
}
