import "server-only";
import { driveServiceEmail, googleAccessToken } from "@/lib/google-drive";

/*
 * Búsquedas de Google que muestran kaffalove.cl (Search Console), para que el agente de
 * marketing elija temas de guías con demanda real. Usa la misma cuenta de servicio de las
 * facturas: hay que agregarla como usuario (permiso Restringido) en Search Console y activar
 * la "Google Search Console API" en el proyecto de Google Cloud. Sin eso devuelve un motivo.
 */

const SITE = "sc-domain:kaffalove.cl";

export type SearchRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };
export type SearchResult = { ok: true; rows: SearchRow[]; from: string; to: string } | { ok: false; reason: string };

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function searchQueries(days = 28): Promise<SearchResult> {
  if (!driveServiceEmail()) return { ok: false, reason: "Falta la cuenta de servicio de Google (GOOGLE_SERVICE_ACCOUNT_JSON)." };
  // Search Console tarda 2 a 3 días en consolidar los datos
  const to = new Date(Date.now() - 2 * 86400_000);
  const from = new Date(to.getTime() - days * 86400_000);
  try {
    const token = await googleAccessToken("https://www.googleapis.com/auth/webmasters.readonly");
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: day(from), endDate: day(to), dimensions: ["query"], rowLimit: 60 }),
      cache: "no-store",
    });
    if (res.status === 403) {
      const text = await res.text();
      if (/SERVICE_DISABLED|has not been used|is disabled/i.test(text)) {
        return { ok: false, reason: "Falta activar la «Google Search Console API» en el proyecto de Google Cloud de la cuenta de servicio." };
      }
      return { ok: false, reason: `La cuenta de servicio no tiene acceso a Search Console. Agrega ${driveServiceEmail()} como usuario.` };
    }
    if (!res.ok) return { ok: false, reason: `Search Console respondió ${res.status}.` };
    const json = (await res.json()) as { rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[] };
    return {
      ok: true,
      from: day(from),
      to: day(to),
      rows: (json.rows ?? []).map((r) => ({
        query: r.keys[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: Math.round(r.ctr * 1000) / 10,
        position: Math.round(r.position * 10) / 10,
      })),
    };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
