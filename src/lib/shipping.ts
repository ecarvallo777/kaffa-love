import type { ProductType } from "@/lib/catalog-types";

/*
 * Tamaño del paquete para Blue Express (tarifario pyme):
 *   XS hasta 0,5 kg  → pedidos de solo café con 1 bolsa (250 g).
 *   S  hasta 3 kg    → todo lo demás (más bolsas, accesorios o promociones).
 * Se usa igual en el navegador (checkout) y en el servidor (precio final).
 */

export const XS_MAX_BAGS = 1;

export type ParcelSize = "xs" | "s";

export function parcelSize(items: { type: ProductType; qty: number }[]): ParcelSize {
  const onlyCoffee = items.length > 0 && items.every((i) => i.type === "cafe");
  const bags = items.reduce((s, i) => s + i.qty, 0);
  return onlyCoffee && bags <= XS_MAX_BAGS ? "xs" : "s";
}

/** Tarifa de la región según el tamaño; sin tarifa XS se usa la S */
export function ratePrice(rate: { priceClp: number; priceXsClp?: number | null }, size: ParcelSize) {
  return size === "xs" && rate.priceXsClp ? rate.priceXsClp : rate.priceClp;
}

/**
 * Comunas que Blue Express cobra con la tarifa de otra zona (por ejemplo, la
 * provincia de Palena es zona Extremo aunque Los Lagos sea Centro).
 */
export type CommuneRate = { commune: string; priceXsClp: number | null; priceClp: number };

export const normalizeCommune = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** La tarifa de la región, reemplazada por la de la comuna si tiene una propia */
export function rateFor<R extends { priceClp: number; priceXsClp?: number | null }>(rate: R, commune: string, communeRates: CommuneRate[]): R {
  const key = normalizeCommune(commune);
  const c = key ? communeRates.find((x) => normalizeCommune(x.commune) === key) : undefined;
  return c ? { ...rate, priceClp: c.priceClp, priceXsClp: c.priceXsClp } : rate;
}
