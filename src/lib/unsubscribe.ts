import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/env";

/*
 * Enlace de baja de un clic para los correos de novedades.
 * Lleva una firma (HMAC del correo) para que nadie pueda dar de baja a otra
 * persona solo conociendo su correo.
 */

function secret() {
  const s = process.env.UNSUBSCRIBE_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (!s) throw new Error("Falta SUPABASE_SECRET_KEY");
  return s;
}

export function unsubscribeToken(email: string) {
  return createHmac("sha256", secret()).update(`baja:${email.trim().toLowerCase()}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(email: string, token: string) {
  const a = Buffer.from(unsubscribeToken(email));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unsubscribeUrl(email: string) {
  const e = email.trim().toLowerCase();
  return `${siteUrl()}/novedades/baja?e=${encodeURIComponent(e)}&t=${unsubscribeToken(e)}`;
}
