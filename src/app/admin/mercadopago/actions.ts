"use server";

import { requireStaff } from "@/lib/auth";
import { requestReleaseReport } from "@/lib/payments/mp-movements";
import type { ActionResult } from "@/components/admin/action-form";

export async function requestReport(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const r = await requestReleaseReport(String(form.get("desde")), String(form.get("hasta")));
  if (!r.ok) return { error: `Mercado Pago respondió ${r.status}: ${r.error}` };
  return { ok: "Reporte pedido. Mercado Pago lo prepara en unos minutos: recarga la página para verlo en la lista." };
}
