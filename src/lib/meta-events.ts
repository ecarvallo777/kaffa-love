/*
 * Píxel de Meta en el navegador (ver src/lib/marketing/meta-pixel.ts).
 * Los eventos se guardan en una cola hasta que el píxel carga; si la persona no
 * acepta las cookies de publicidad, el píxel nunca carga y la cola se descarta.
 */

export const CONSENT_COOKIE = "kaffa-cookies";
export type Consent = "si" | "no" | null;

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[][]; loaded?: boolean; version?: string; push?: unknown };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export function readConsent(): Consent {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=(si|no)`));
    return (m?.[1] as Consent) ?? null;
  } catch {
    return null;
  }
}

export function writeConsent(v: "si" | "no" | null) {
  try {
    document.cookie = v
      ? `${CONSENT_COOKIE}=${v}; path=/; max-age=${180 * 86400}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`
      : `${CONSENT_COOKIE}=; path=/; max-age=0`;
  } catch {}
}

let ready = false;
const pending: [string, Record<string, unknown>, string | undefined][] = [];

/** Carga el píxel (una vez) y envía lo que estaba en cola */
export function startPixel(pixelId: string) {
  if (ready) return;
  ready = true;
  if (!window.fbq) {
    // Código base de Meta, sin el <script> en línea
    const f: Fbq = function (...args: unknown[]) {
      if (f.callMethod) f.callMethod(...args);
      else f.queue!.push(args);
    } as Fbq;
    f.push = f;
    f.loaded = true;
    f.version = "2.0";
    f.queue = [];
    window.fbq = f;
    window._fbq = f;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  }
  window.fbq!("init", pixelId);
  for (const [name, params, eventId] of pending.splice(0)) send(name, params, eventId);
}

function send(name: string, params: Record<string, unknown>, eventId?: string) {
  window.fbq?.("track", name, params, eventId ? { eventID: eventId } : undefined);
}

/** Evento estándar de Meta (ViewContent, AddToCart, InitiateCheckout, Purchase, PageView) */
export function metaEvent(name: string, params: Record<string, unknown> = {}, eventId?: string) {
  try {
    if (ready) send(name, params, eventId);
    else if (pending.length < 30) pending.push([name, params, eventId]);
  } catch {
    // La medición nunca debe romper la tienda
  }
}
