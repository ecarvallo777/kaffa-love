"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { REGIONES } from "@/lib/chile";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveStoreSettings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const current = await getSettings();

  const rates: Settings["shippingRates"] = [];
  for (const region of REGIONES) {
    const i = REGIONES.indexOf(region);
    const price = Number(String(form.get(`price_${i}`) ?? "").replace(/[.$\s]/g, ""));
    if (!Number.isInteger(price) || price < 0) return { error: `Revisa la tarifa de ${region}.` };
    rates.push({ region, priceClp: price, days: String(form.get(`days_${i}`) ?? "").trim() || "Por confirmar", enabled: form.get(`enabled_${i}`) === "on" });
  }
  const freeRaw = String(form.get("freeShippingFromClp") ?? "").replace(/[.$\s]/g, "");
  const free = freeRaw ? Number(freeRaw) : null;
  if (free !== null && (!Number.isInteger(free) || free <= 0)) return { error: "El monto para despacho gratis no es válido." };
  const returnDays = Number(form.get("returnDays"));
  if (!Number.isInteger(returnDays) || returnDays < 10) return { error: "El plazo de devolución debe ser de al menos 10 días (derecho a retracto)." };
  const pct = (k: string) => Number(String(form.get(k) ?? "").replace(",", ".").replace("%", "").trim());
  const ivaPct = pct("ivaPct");
  const mpFeriaPct = pct("mpFeriaPct");
  const mpTiendaPct = pct("mpTiendaPct");
  if (!(ivaPct >= 0 && ivaPct <= 50)) return { error: "El IVA debe ser un porcentaje entre 0 y 50." };
  if (!(mpFeriaPct >= 0 && mpFeriaPct <= 20) || !(mpTiendaPct >= 0 && mpTiendaPct <= 20)) {
    return { error: "Las comisiones de Mercado Pago deben ser porcentajes entre 0 y 20." };
  }
  const repurchaseDays = Number(form.get("repurchaseDays"));
  if (!Number.isInteger(repurchaseDays) || repurchaseDays < 5 || repurchaseDays > 90) {
    return { error: "Los días para el recordatorio de recompra deben estar entre 5 y 90." };
  }

  try {
    await saveSettings({
      ...current,
      shippingRates: rates,
      freeShippingFromClp: free,
      contactEmail: String(form.get("contactEmail") ?? "").trim(),
      contactPhone: String(form.get("contactPhone") ?? "").trim(),
      instagram: String(form.get("instagram") ?? "").trim(),
      returnDays,
      ivaPct,
      mpFeriaPct,
      mpTiendaPct,
      emailAbandonedCart: form.get("emailAbandonedCart") === "on",
      emailRepurchase: form.get("emailRepurchase") === "on",
      repurchaseDays,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  updateTag("settings");
  refresh();
  return { ok: "Configuración guardada." };
}
