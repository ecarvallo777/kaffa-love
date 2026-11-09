"use client";

/*
 * Medición del embudo de compra, anónima: cada navegador tiene un id al azar
 * (sin nombre ni correo). Se envía con sendBeacon para no frenar la página.
 * Los eventos quedan en la tabla `events` y se ven en Administración → Reportes.
 */

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

export function track(type: TrackType, data: Record<string, string | number | null> = {}) {
  try {
    const aid = visitorId();
    if (!aid) return;
    const body = JSON.stringify({ type, aid, data });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    else void fetch("/api/track", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // La medición nunca debe romper la tienda
  }
}
