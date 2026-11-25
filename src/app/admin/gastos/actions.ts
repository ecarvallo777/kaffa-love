"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { CATEGORIES, LEDGER_START, classifyEntry, requestMovementsReport, syncLedger, type Category } from "@/lib/expense-ledger";
import { connectSheet, getSheetConfig, syncSheet } from "@/lib/expense-sheet";
import type { ActionResult } from "@/components/admin/action-form";

/** Lee Mercado Pago ahora y actualiza la planilla */
export async function syncNowAction(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  try {
    const r = await syncLedger();
    if (!r.enabled) return { error: "Solo funciona en producción (con la clave real de Mercado Pago)." };
    const sheet = (await getSheetConfig()) ? await syncSheet().then(() => " Planilla actualizada.").catch((e: Error) => ` La planilla no se pudo actualizar: ${e.message}`) : "";
    refresh();
    return { ok: `${r.added ? `${r.added} gasto${r.added === 1 ? "" : "s"} nuevo${r.added === 1 ? "" : "s"}.` : "Sin gastos nuevos."}${sheet}` };
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

export async function requestMovementsAction(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  try {
    await requestMovementsReport(new Date(LEDGER_START), new Date());
    refresh();
    return { ok: "Reporte pedido. Mercado Pago lo prepara en unos minutos: recarga la página." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
