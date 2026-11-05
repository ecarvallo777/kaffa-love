"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { adjustStock } from "@/lib/stock";
import { logEvent } from "@/lib/events";
import type { ActionResult } from "@/components/admin/action-form";

export async function adjustStockAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const productId = String(form.get("productId") ?? "");
  const mode = String(form.get("mode") ?? "sumar");
  const qty = Number(form.get("qty"));
  const reason = String(form.get("reason")) === "compra" ? "compra" : "ajuste";
  const note = String(form.get("note") ?? "").trim();

  if (!productId) return { error: "Elige un producto." };
  if (!Number.isInteger(qty) || qty <= 0) return { error: "La cantidad debe ser un número entero mayor que cero." };
  if (reason === "ajuste" && !note) return { error: "Explica brevemente el motivo del ajuste (ej.: bolsa dañada, conteo)." };

  try {
    const delta = mode === "restar" ? -qty : qty;
    const r = await adjustStock({ productId, delta, reason, note, userId: staff.userId });
    await logEvent("stock_ajustado", "product", productId, { delta, motivo: reason, nota: note, antes: r.before, despues: r.after, por: staff.email });
    updateTag("catalog");
    refresh();
    return { ok: `${r.name}: ${r.before} → ${r.after} unidades.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
