/*
 * Canal de llegada de un visitante (feria, instagram, google…), para saber de
 * dónde vienen las ventas. Viene de `?utm_source=` en los enlaces etiquetados
 * (por ejemplo, el QR de la feria) o, si no hay, del sitio de origen.
 * Se usa en el navegador (registro) y en el servidor (validación y reportes).
 */

export const SOURCE_RE = /^[a-z0-9_-]{1,24}$/;

export function normalizeSource(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const v = s.trim().toLowerCase().replace(/\s+/g, "_");
  return SOURCE_RE.test(v) ? v : null;
}

/** Canal a partir del sitio de origen; null si es la propia tienda o no hay */
export function sourceFromReferrer(referrer: string, ownHost: string): string | null {
  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  if (!host || host === ownHost.replace(/^www\./, "")) return null;
  if (/(^|\.)google\./.test(host)) return "google";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(host)) return "facebook";
  if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com)$/.test(host)) return "buscador";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp";
  return "otro_sitio";
}

const NAMES: Record<string, string> = {
  feria: "Feria (QR)",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  buscador: "Otros buscadores",
  whatsapp: "WhatsApp",
  correo: "Correos",
  otro_sitio: "Otros sitios",
  directo: "Directo o sin dato",
};

export const sourceName = (s: string) => NAMES[s] ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
