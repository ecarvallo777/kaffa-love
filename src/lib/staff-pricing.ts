import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { getProductCosts } from "@/lib/costs";
import { makeCostResolver } from "@/lib/profit";
import { getSettings } from "@/lib/settings";

/*
 * Precio equipo: los administradores compran al costo.
 * Cada producto cuesta lo justo para que, después del IVA y la comisión online de Mercado Pago,
 * a la tienda le quede exactamente el costo:
 *   precio / (1 + IVA) − precio × comisión = costo   →   precio = costo / (1 / (1 + IVA) − comisión)
 * El envío se cobra normal y sin despacho gratis. No se suma al descuento de bienvenida.
 * Solo con la sesión de administrador iniciada y pagando con ese mismo correo
 * (escribir el correo de un administrador no basta).
 */

export function staffUnitPrice(costClp: number, ivaPct: number, commissionPct: number) {
  return Math.ceil(costClp / (1 / (1 + ivaPct / 100) - commissionPct / 100));
}

/** Administrador con sesión iniciada (o null) */
export async function getStaffBuyer() {
  const staff = await getStaff().catch(() => null);
  return staff?.role === "admin" && staff.email ? { email: staff.email.toLowerCase(), name: staff.name } : null;
}

/** Precio equipo por producto (sin costo registrado → sin precio equipo: se cobra normal) */
export async function getStaffPrices(): Promise<Record<string, number>> {
  const [costs, { data: bundleItems }, settings] = await Promise.all([
    getProductCosts(),
    createAdminClient().from("bundle_items").select("bundle_id, product_id, quantity"),
    getSettings(),
  ]);
  const costOf = makeCostResolver(costs, bundleItems ?? []);
  const { data: products } = await createAdminClient().from("products").select("id").eq("active", true);
  const out: Record<string, number> = {};
  for (const p of products ?? []) {
    const cost = costOf(p.id);
    if (cost !== null && cost > 0) out[p.id] = staffUnitPrice(cost, settings.ivaPct, settings.mpTiendaPct);
  }
  return out;
}
