import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recibe eventos anónimos del embudo de compra (ver src/lib/track.ts).
 * Solo acepta tipos conocidos y datos acotados; ignora bots y limita la frecuencia.
 */

const TYPES = new Set(["vista_producto", "agrego_carrito", "inicio_checkout", "recupero_carrito"]);
const BOT = /bot|crawl|spider|slurp|headless|preview|lighthouse|facebookexternalhit|whatsapp/i;
const UUID = /^[0-9a-f-]{36}$/i;

// Límite simple por IP en memoria (por instancia): 60 eventos por minuto
const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 });
    if (hits.size > 5000) hits.clear();
    return false;
  }
  h.n++;
  return h.n > 60;
}

export async function POST(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (BOT.test(ua) || limited(ip)) return new NextResponse(null, { status: 204 });

  let body: { type?: string; aid?: string; data?: Record<string, unknown> };
  try {
    const raw = await request.text();
    if (raw.length > 2000) return new NextResponse(null, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!body.type || !TYPES.has(body.type) || !body.aid || !UUID.test(body.aid)) return new NextResponse(null, { status: 400 });

  // Solo campos conocidos, cortos y sin datos personales
  const d = body.data ?? {};
  const data: Record<string, string | number> = { aid: body.aid };
  if (typeof d.product_id === "string" && UUID.test(d.product_id)) data.product_id = d.product_id;
  if (typeof d.qty === "number" && Number.isInteger(d.qty) && d.qty > 0 && d.qty < 100) data.qty = d.qty;
  if (typeof d.items === "number" && Number.isInteger(d.items) && d.items >= 0 && d.items < 100) data.items = d.items;
  if (typeof d.total === "number" && Number.isInteger(d.total) && d.total >= 0 && d.total < 10_000_000) data.total = d.total;
  if (typeof d.origen === "string" && /^[a-z_]{1,20}$/.test(d.origen)) data.origen = d.origen;

  const { error } = await createAdminClient().from("events").insert({ type: body.type, entity: "visitor", entity_id: null, data });
  if (error) console.error("[track]", error.message);
  return new NextResponse(null, { status: 204 });
}
