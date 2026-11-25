"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { CATEGORIES, classifyEntry, importLatestMovements, requestDailyMovements, syncLedger, type Category } from "@/lib/expense-ledger";
import { connectSheet, getSheetConfig, syncSheet } from "@/lib/expense-sheet";
import type { ActionResult } from "@/components/admin/action-form";

/**
 * Un solo botón: lee los pagos, suma las transferencias del último reporte (si está listo)
 * y pide uno nuevo (la tarea de cada 5 minutos lo suma apenas Mercado Pago lo prepare).
 */
export async function syncNowAction(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  try {
    const r = await syncLedger();
    if (!r.enabled) return { error: "Solo funciona en producción (con la clave real de Mercado Pago)." };
    // Transferencias y retiros del último reporte de movimientos, si ya está listo
    const m = await importLatestMovements().catch(() => ({ read: false, added: 0 }));
    r.added += m.added;
    await requestDailyMovements(new Date(), true).catch((e) => console.error("[gastos] reporte de movimientos:", e));
    const sheet = (await getSheetConfig()) ? await syncSheet().then(() => " Planilla actualizada.").catch((e: Error) => ` La planilla no se pudo actualizar: ${e.message}`) : "";
    refresh();
    return {
      ok: `${r.added ? `${r.added} gasto${r.added === 1 ? "" : "s"} nuevo${r.added === 1 ? "" : "s"}.` : "Sin gastos nuevos."}${sheet} Las transferencias y retiros recientes se suman solos en unos minutos.`,
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function classifyAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const category = String(form.get("category")) as Category;
  if (!(CATEGORIES as readonly string[]).includes(category)) return { error: "Categoría no válida." };
  try {
    const e = await classifyEntry(String(form.get("id")), category, String(form.get("note") ?? "").trim() || undefined, form.get("remember") === "on");
    await logEvent("gasto_clasificado", "expense", null, { pago: e.id, categoria: category, monto: e.amountClp, por: staff.email });
  } catch (e) {
    return { error: (e as Error).message };
  }
  // La planilla se actualiza después de responder (no hace esperar al admin)
  after(() => syncSheet().catch((e) => console.error("[gastos] planilla:", e)));
  refresh();
  return { ok: "Guardado." };
}

export async function connectSheetAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  try {
    const cfg = await connectSheet(String(form.get("url") ?? ""));
    await syncSheet();
    refresh();
    return { ok: `Planilla «${cfg.title}» conectada y actualizada.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
