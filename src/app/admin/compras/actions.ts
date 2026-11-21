"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import type { ActionResult } from "@/components/admin/action-form";
import { applyPurchase, getPurchase, removePurchase, setPurchaseStatus, syncDriveInvoices, type ApplyLine } from "@/lib/purchases";
import { studyMarket, studyProduct, STUDY_TYPES } from "@/lib/pricing";

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
    await applyPurchase(id, lines, staff, { costOnly: form.get("soloCosto") === "1" });
  } catch (e) {
    refresh();
    return { error: (e as Error).message };
  }
  updateTag("catalog");
  redirect(`/admin/compras?aplicada=${form.get("soloCosto") === "1" ? "costo" : "stock"}`);
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

/** Precio sugerido para un producto nuevo de la factura: estudio de mercado con su costo (tarda 1 a 2 minutos) */
export async function suggestNewProductPrice(input: { name: string; type: "cafe" | "accesorio"; costClp: number }) {
  await requireStaff(["admin"]);
  if (!input.name?.trim() || !(input.costClp > 0)) return { error: "Falta el nombre o el costo del producto." };
  if (!STUDY_TYPES.includes(input.type)) return { error: "Solo se sugiere precio para accesorios." };
  try {
    const r = await studyMarket({ name: input.name.trim(), type: input.type, costClp: Math.round(input.costClp) });
    return { ok: true as const, ...r };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Precio sugerido para un accesorio que ya existe y nunca se ha analizado, con el costo de esta factura. Queda en Admin → Precios. */
export async function suggestExistingProductPrice(input: { productId: string; costClp: number }) {
  await requireStaff(["admin"]);
  if (!(input.costClp > 0)) return { error: "Falta el costo del producto." };
  try {
    const s = await studyProduct(input.productId, Math.round(input.costClp));
    if (s.status !== "listo") return { error: s.error ?? "No se pudo estudiar." };
    return {
      ok: true as const,
      suggestedPriceClp: s.suggestedPriceClp!,
      floorPriceClp: s.floorPriceClp!,
      summary: s.summary ?? "",
      references: s.references ?? [],
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
