"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { getPriceStudies, markPriceApplied, queuePriceStudies, studyProduct, STUDY_TYPES } from "@/lib/pricing";
import type { ActionResult } from "@/components/admin/action-form";

/** Estudia un producto ahora (1 a 2 minutos) */
export async function studyNowAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const s = await studyProduct(String(form.get("productId")));
  refresh();
  return s.status === "listo" ? { ok: `Sugerido: $${s.suggestedPriceClp?.toLocaleString("es-CL")}.` } : { error: s.error ?? "No se pudo estudiar." };
}

/** Deja en cola todos los productos con costo: la tarea periódica los estudia de a uno (unos 5 minutos cada uno) */
export async function studyAllAction(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const db = createAdminClient();
  const [{ data: products }, { data: costs }] = await Promise.all([
    db.from("products").select("id, name").eq("active", true).in("type", STUDY_TYPES),
    db.from("product_costs").select("product_id"),
  ]);
  const withCost = new Set((costs ?? []).map((c) => c.product_id));
  const n = await queuePriceStudies((products ?? []).filter((p) => withCost.has(p.id)));
  refresh();
  return { ok: `${n} productos en cola. Se estudian de a uno cada 5 minutos; vuelve en un rato.` };
}

/** Cambia el precio de venta al sugerido (o al que se escriba) y refresca la tienda */
export async function applyPriceAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const productId = String(form.get("productId"));
  const price = Number(String(form.get("price") ?? "").replace(/[.\s$]/g, ""));
  if (!Number.isInteger(price) || price <= 0) return { error: "Precio no válido." };
  const db = createAdminClient();
  const { data: before } = await db.from("products").select("name, price_clp").eq("id", productId).single();
  const { error } = await db.from("products").update({ price_clp: price, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) return { error: error.message };
  const studies = await getPriceStudies();
  if (studies[productId]) await markPriceApplied(productId);
  await logEvent("producto_editado", "product", productId, { nombre: before?.name, precio_anterior: before?.price_clp, precio: price, origen: "estudio de precios", por: staff.email });
  updateTag("catalog");
  refresh();
  return { ok: `Precio actualizado a $${price.toLocaleString("es-CL")}.` };
}
