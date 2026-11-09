"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { applyInventoryCount, type CountResult } from "@/lib/inventory";

export type CountState = { results?: CountResult[]; error?: string } | null;

export async function applyCount(_prev: CountState, form: FormData): Promise<CountState> {
  const staff = await requireStaff(["admin"]);
  const reason = form.get("reason") === "compra" ? "compra" : "ajuste";
  const note = String(form.get("note") ?? "").trim().slice(0, 200);
  let counts: { productId: string; counted: number }[] = [];
  try {
    counts = (JSON.parse(String(form.get("counts") ?? "[]")) as { productId: string; counted: number }[]).filter(
      (c) => typeof c.productId === "string" && Number.isInteger(c.counted) && c.counted >= 0,
    );
  } catch {
    return { error: "No se pudo leer el conteo." };
  }
  if (!counts.length) return { error: "No contaste ningún producto todavía." };

  const results = await applyInventoryCount({ counts, reason, note, userId: staff.userId });
  const changed = results.filter((r) => r.delta !== 0 && !r.error);
  await logEvent("inventario_contado", "inventory", null, {
    motivo: reason,
    nota: note,
    productos: results.length,
    con_diferencia: changed.length,
    unidades: changed.reduce((s, r) => s + r.delta, 0),
    por: staff.email,
  });
  updateTag("catalog");
  refresh();
  return { results };
}
