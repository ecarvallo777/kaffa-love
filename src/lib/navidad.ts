/*
 * Fechas límite para que un despacho llegue antes de Navidad (Blue Express se congestiona en
 * diciembre). Decisión del negocio, 27-11-2026: Santiago hasta el 19 y regiones hasta el 16.
 * Para el próximo año basta con cambiar las fechas.
 */
export const CHRISTMAS = {
  santiago: "2026-12-19",
  regiones: "2026-12-16",
  /** Desde este día ya no se muestra nada */
  end: "2026-12-25",
};

export const SANTIAGO_REGION = "Metropolitana de Santiago";

/** Fecha de hoy en Chile (AAAA-MM-DD) */
export const todayInChile = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);

const day = (iso: string) => Number(iso.slice(8, 10));

/** Fecha límite de la región, o null si ya pasó (o si terminó la temporada) */
export function christmasCutoff(region: string, today = todayInChile()): string | null {
  if (today >= CHRISTMAS.end) return null;
  const cutoff = region === SANTIAGO_REGION ? CHRISTMAS.santiago : CHRISTMAS.regiones;
  return today <= cutoff ? cutoff : null;
}

/** Texto del aviso de la tienda según el día; null fuera de temporada */
export function christmasMessage(today = todayInChile()): string | null {
  if (today >= CHRISTMAS.end) return null;
  if (today <= CHRISTMAS.regiones)
    return `Navidad: compra hasta el ${day(CHRISTMAS.regiones)} de diciembre (regiones) o el ${day(CHRISTMAS.santiago)} (Santiago) para recibir tu pedido a tiempo.`;
  if (today <= CHRISTMAS.santiago)
    return `Navidad: en Santiago, compra hasta el ${day(CHRISTMAS.santiago)} de diciembre para recibir a tiempo. A regiones ya podría llegar después del 25.`;
  return "Los despachos de hoy podrían llegar después de Navidad. Si estás cerca de San Carlos, retira sin costo.";
}

export const fmtCutoff = (iso: string) => `${day(iso)} de diciembre`;
