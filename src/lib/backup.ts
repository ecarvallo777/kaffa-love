import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Respaldo completo de la tienda (docs/PRODUCCION.md, 7.4): todas las tablas, los JSON
 * del bucket "config" y la lista de usuarios de Auth (sin contraseñas).
 * Lo descarga cada semana un Apps Script en el Google Drive de la tienda
 * (scripts/respaldo/apps-script.gs) desde /api/respaldo.
 * Para restaurar: scripts/respaldo/restaurar.mjs.
 *
 * No incluye las fotos de productos (bucket "productos"): se vuelven a subir desde el admin.
 */

/** Orden en que se restauran (las referencias primero). Las tablas nuevas se agregan solas al final. */
export const TABLE_ORDER = [
  "categories",
  "products",
  "bundle_items",
  "product_costs",
  "pickup_locations",
  "staff",
  "customers",
  "addresses",
  "fair_sessions",
  "orders",
  "order_items",
  "stock_movements",
  "events",
];

const PAGE = 1000;

/** Todas las tablas que expone la base (así una tabla nueva no queda fuera del respaldo) */
async function listTables() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY!;
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`No se pudo listar las tablas (${res.status})`);
  const spec = (await res.json()) as { paths?: Record<string, unknown> };
  const found = Object.keys(spec.paths ?? {})
    .filter((p) => p !== "/" && !p.startsWith("/rpc/"))
    .map((p) => p.slice(1));
  return [...TABLE_ORDER.filter((t) => found.includes(t)), ...found.filter((t) => !TABLE_ORDER.includes(t)).sort()];
}

/** Columnas para ordenar al paginar (sin orden estable se pueden saltar o repetir filas) */
const SORT: Record<string, string[]> = {
  product_costs: ["product_id"],
  staff: ["user_id"],
  bundle_items: ["bundle_id", "product_id"],
};

async function dumpTable(table: string) {
  const db = createAdminClient();
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db.from(table).select("*");
    for (const col of SORT[table] ?? ["id"]) query = query.order(col);
    let { data, error } = await query.range(from, from + PAGE - 1);
    // Tabla nueva sin columna "id": se lee sin orden (sirve mientras tenga menos de 1000 filas)
    if (error && from === 0 && !SORT[table]) ({ data, error } = await db.from(table).select("*").range(0, PAGE - 1));
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function dumpConfig() {
  const db = createAdminClient();
  const { data: files, error } = await db.storage.from("config").list("", { limit: 1000 });
  if (error) throw new Error(`No se pudo listar config: ${error.message}`);
  const out: Record<string, unknown> = {};
  for (const f of files ?? []) {
    // Las claves de acceso (por ejemplo, el token de Instagram) no van al respaldo: se vuelven a conectar
    if (!f.name.endsWith(".json") || f.name.startsWith("clave-")) continue;
    const { data, error: e } = await db.storage.from("config").download(f.name);
    if (e || !data) throw new Error(`No se pudo leer config/${f.name}: ${e?.message}`);
    out[f.name] = JSON.parse(await data.text());
  }
  return out;
}

async function dumpAuthUsers() {
  const db = createAdminClient();
  const users: { id: string; email: string | undefined; created_at: string }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`No se pudo leer los usuarios: ${error.message}`);
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email, created_at: u.created_at })));
    if (data.users.length < 1000) return users;
  }
}

export async function buildBackup() {
  const tables: Record<string, unknown[]> = {};
  for (const t of await listTables()) tables[t] = await dumpTable(t);
  return {
    version: 1,
    created_at: new Date().toISOString(),
    tables,
    config: await dumpConfig(),
    auth_users: await dumpAuthUsers(),
  };
}
