"use client";

/*
 * Medición del embudo de compra, anónima: cada navegador tiene un id al azar
 * (sin nombre ni correo). Se envía con sendBeacon para no frenar la página.
 * Los eventos quedan en la tabla `events` y se ven en Administración → Reportes.
 */

import { normalizeSource, sourceFromReferrer } from "@/lib/source";

export type TrackType = "vista_producto" | "agrego_carrito" | "inicio_checkout" | "recupero_carrito";

const AID_KEY = "kaffa-aid";

function visitorId() {
  try {
    let id = localStorage.getItem(AID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(AID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/*
 * Canal de llegada: se guarda el último canal conocido (un enlace etiquetado
 * o un sitio externo) por 30 días; entrar directo no lo borra.
 */
const SRC_KEY = "kaffa-src";
const SRC_DAYS = 30;

export function captureSource() {
  try {
    const params = new URLSearchParams(location.search);
    const src = normalizeSource(params.get("utm_source")) ?? sourceFromReferrer(document.referrer, location.hostname);
    if (src) localStorage.setItem(SRC_KEY, JSON.stringify({ s: src, at: Date.now() }));
  } catch {
    // sin almacenamiento: no se mide el canal
  }
}

export function currentSource(): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(SRC_KEY) ?? "null") as { s?: string; at?: number } | null;
    if (!v?.s || !v.at || Date.now() - v.at > SRC_DAYS * 86400_000) return null;
    return normalizeSource(v.s);
  } catch {
    return null;
  }
}

export function track(type: TrackType, data: Record<string, string | number | null> = {}) {
  try {
    const aid = visitorId();
    if (!aid) return;
    const fuente = currentSource();
    const body = JSON.stringify({ type, aid, data: fuente ? { ...data, fuente } : data });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // La medición nunca debe romper la tienda
  }
}
