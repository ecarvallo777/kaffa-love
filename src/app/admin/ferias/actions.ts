"use server";

import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { EXPENSE_CATEGORIES, setFairExpenses, type FairExpense } from "@/lib/costs";
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
