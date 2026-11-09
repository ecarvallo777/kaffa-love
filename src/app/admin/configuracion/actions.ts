"use server";

import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { REGIONES } from "@/lib/chile";
import { getSettings, saveSettings, type Settings } from "@/lib/settings";
import { sendAutomationSamples } from "@/lib/automations";
import type { ActionResult } from "@/components/admin/action-form";

export async function saveStoreSettings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const current = await getSettings();

  const rates: Settings["shippingRates"] = [];
  for (const region of REGIONES) {
    const i = REGIONES.indexOf(region);
    const price = Number(String(form.get(`price_${i}`) ?? "").replace(/[.$\s]/g, ""));
    if (!Number.isInteger(price) || price < 0) return { error: `Revisa la tarifa de ${region}.` };
    const xsRaw = String(form.get(`xs_${i}`) ?? "").replace(/[.$\s]/g, "");
    const xs = xsRaw ? Number(xsRaw) : null;
    if (xs !== null && (!Number.isInteger(xs) || xs <= 0)) return { error: `Revisa la tarifa XS de ${region}.` };
    rates.push({ region, priceClp: price, priceXsClp: xs, days: String(form.get(`days_${i}`) ?? "").trim() || "Por confirmar", enabled: form.get(`enabled_${i}`) === "on" });
  }
  const communeRates: Settings["communeRates"] = [];
  const num = (k: string) => {
    const raw = String(form.get(k) ?? "").replace(/[.$\s]/g, "");
    return raw ? Number(raw) : null;
  };
  for (let i = 0; i < Number(form.get("communeRows") ?? 0); i++) {
    const commune = String(form.get(`cname_${i}`) ?? "").trim();
    if (!commune) continue;
    const priceClp = num(`cs_${i}`);
    const priceXsClp = num(`cxs_${i}`);
    if (priceClp === null || !Number.isInteger(priceClp) || priceClp <= 0) return { error: `Falta la tarifa S de ${commune}.` };
    if (priceXsClp !== null && (!Number.isInteger(priceXsClp) || priceXsClp <= 0)) return { error: `Revisa la tarifa XS de ${commune}.` };
    communeRates.push({ commune, priceXsClp, priceClp });
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
      communeRates,
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

/** Envía un ejemplo de cada correo automático (no registra nada ni afecta a clientes) */
export async function sendSampleEmails(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const to = String(form.get("to") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: "Escribe un correo válido." };
  const res = await sendAutomationSamples(to, staff.name);
  return "error" in res ? { error: res.error } : { ok: `Listo: revisa ${to} (2 correos marcados como [Ejemplo]).` };
}
