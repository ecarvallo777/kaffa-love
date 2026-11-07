import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Grind } from "@/lib/catalog-types";

/*
 * Carrito de los clientes con sesión, guardado en Supabase Storage
 * (un archivo JSON privado por cliente) para verlo desde cualquier dispositivo.
 * Precios y stock se vuelven a validar al pagar, así que aquí solo se guarda lo elegido.
 */

export type StoredCartLine = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  priceClp: number;
  grind: Grind | null;
  qty: number;
  maxQty: number | null;
};

const BUCKET = "carritos";
const GRINDS = ["grano", "fina", "media", "gruesa"];
const MAX_LINES = 50;

/** Descarta cualquier dato con forma inesperada (viene del navegador) */
export function sanitizeLines(input: unknown): StoredCartLine[] {
  if (!Array.isArray(input)) return [];
  const out: StoredCartLine[] = [];
  for (const l of input.slice(0, MAX_LINES)) {
    if (!l || typeof l !== "object") continue;
    const x = l as Record<string, unknown>;
    const qty = Number(x.qty);
    const grind = x.grind === null || x.grind === undefined ? null : String(x.grind);
    if (typeof x.productId !== "string" || !/^[0-9a-f-]{36}$/i.test(x.productId)) continue;
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) continue;
    if (grind !== null && !GRINDS.includes(grind)) continue;
    out.push({
      key: `${x.productId}:${grind ?? "-"}`,
      productId: x.productId,
      slug: typeof x.slug === "string" ? x.slug.slice(0, 120) : "",
      name: typeof x.name === "string" ? x.name.slice(0, 200) : "",
      priceClp: Number.isInteger(x.priceClp) ? (x.priceClp as number) : 0,
      grind: grind as Grind | null,
      qty,
      maxQty: Number.isInteger(x.maxQty) ? (x.maxQty as number) : null,
    });
  }
  return out;
}

export async function loadServerCart(customerId: string): Promise<StoredCartLine[]> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(`${customerId}.json`);
  if (error || !data) return [];
  try {
    return sanitizeLines(JSON.parse(await data.text()));
  } catch {
    return [];
  }
}

export async function saveServerCart(customerId: string, lines: StoredCartLine[]) {
  const db = createAdminClient();
  const body = new Blob([JSON.stringify(lines)], { type: "application/json" });
  const path = `${customerId}.json`;
  let { error } = await db.storage.from(BUCKET).upload(path, body, { upsert: true });
  if (error && /not found/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: false });
    ({ error } = await db.storage.from(BUCKET).upload(path, body, { upsert: true }));
  }
  if (error) console.error("[carrito] No se pudo guardar:", error.message);
}

/** Une dos carritos: misma línea (producto + molienda) → la cantidad mayor */
export function mergeLines(a: StoredCartLine[], b: StoredCartLine[]) {
  const map = new Map<string, StoredCartLine>();
  for (const l of [...a, ...b]) {
    const cur = map.get(l.key);
    map.set(l.key, cur ? { ...l, qty: Math.max(cur.qty, l.qty) } : l);
  }
  return [...map.values()].slice(0, MAX_LINES);
}
