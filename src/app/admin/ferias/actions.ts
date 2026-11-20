"use server";

import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { EXPENSE_CATEGORIES, setFairExpenses, type FairExpense } from "@/lib/costs";
import { decideMpExpense, syncFairMpExpenses, type MpExpenseStatus } from "@/lib/fair-mp-expenses";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveFairExpenses(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const sessionId = String(form.get("sessionId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { error: "Jornada no válida." };

  let expenses: FairExpense[] = [];
  try {
    expenses = (JSON.parse(String(form.get("expenses") ?? "[]")) as Partial<FairExpense>[])
      .map((e, i) => ({
        id: String(e.id || `g${Date.now().toString(36)}${i}`),
        category: (EXPENSE_CATEGORIES as readonly string[]).includes(String(e.category)) ? (e.category as FairExpense["category"]) : "Otro",
        concept: String(e.concept ?? "").trim().slice(0, 120),
        amountClp: Math.round(Number(e.amountClp)),
      }))
      .filter((e) => Number.isFinite(e.amountClp) && e.amountClp > 0);
  } catch {
    return { error: "No se pudieron leer los gastos." };
  }
  if (expenses.some((e) => e.amountClp > 50_000_000)) return { error: "Revisa los montos: alguno es demasiado alto." };

  try {
    await setFairExpenses(sessionId, expenses);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await logEvent("gastos_feria", "fair_session", sessionId, {
    total: expenses.reduce((s, e) => s + e.amountClp, 0),
    gastos: expenses.length,
    por: staff.email,
  });
  refresh();
  return { ok: "Gastos guardados." };
}

/** Busca ahora en Mercado Pago los pagos de los días de la jornada */
export async function syncMpExpensesAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const sessionId = String(form.get("sessionId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return { error: "Jornada no válida." };
  try {
    const r = await syncFairMpExpenses([sessionId]);
    if (!r.enabled) return { error: "Solo funciona en producción (con la clave real de Mercado Pago)." };
    refresh();
    return { ok: r.added ? `${r.added} pago${r.added === 1 ? "" : "s"} nuevo${r.added === 1 ? "" : "s"} de Mercado Pago.` : "No hay pagos nuevos en Mercado Pago para estos días." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function decideMpExpenseAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const status = String(form.get("status")) as MpExpenseStatus;
  const category = String(form.get("category")) as FairExpense["category"];
  if (!["feria", "mercaderia", "no_gasto"].includes(status)) return { error: "Clasificación no válida." };
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) return { error: "Categoría no válida." };
  try {
    const item = await decideMpExpense(String(form.get("mpId")), { status, category, remember: form.get("remember") === "on" });
    await logEvent("gasto_mp_clasificado", "fair_session", item.sessionId, { pago: item.mpId, estado: status, categoria: category, por: staff.email });
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return { ok: "Guardado." };
}
