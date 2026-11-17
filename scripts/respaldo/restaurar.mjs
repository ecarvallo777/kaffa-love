// Restaura un respaldo de Google Drive (kaffa-love-AAAA-MM-DD.json.gz). Ver README.md en esta carpeta.
//
//   node scripts/respaldo/restaurar.mjs respaldo.json.gz                       resumen del respaldo
//   node scripts/respaldo/restaurar.mjs respaldo.json.gz --sql restaurar.sql   genera el SQL de las tablas
//   node scripts/respaldo/restaurar.mjs respaldo.json.gz --config              muestra los archivos de configuración
//   node scripts/respaldo/restaurar.mjs respaldo.json.gz --config --aplicar    los sube (reemplaza los actuales)
//
// El SQL se corre en el SQL Editor de Supabase sobre una base con las migraciones aplicadas.
// No borra nada: las filas que ya existen se dejan como están (on conflict do nothing).
import fs from "node:fs";
import zlib from "node:zlib";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--sql");
if (!file) {
  console.error("Uso: node scripts/respaldo/restaurar.mjs respaldo.json.gz [--sql salida.sql] [--config [--aplicar]]");
  process.exit(1);
}
let raw = fs.readFileSync(file);
if (raw[0] === 0x1f && raw[1] === 0x8b) raw = zlib.gunzipSync(raw);
const backup = JSON.parse(raw.toString("utf8"));
if (backup.version !== 1 || !backup.tables) throw new Error("No parece un respaldo de Kaffa Love.");

console.log(`Respaldo del ${backup.created_at}`);
for (const [t, rows] of Object.entries(backup.tables)) console.log(`  ${t}: ${rows.length}`);
console.log(`  config: ${Object.keys(backup.config ?? {}).join(", ") || "-"}`);
console.log(`  usuarios de Auth: ${backup.auth_users?.length ?? 0} (sin contraseña: se vuelven a crear con scripts/crear-usuario.mjs o con "Olvidé mi contraseña")`);

// --- SQL --------------------------------------------------------------------

const ident = (s) => `"${s.replace(/"/g, '""')}"`;
const str = (s) => `'${s.replace(/'/g, "''")}'`;
/** Literal sin tipo: Postgres lo convierte al tipo de la columna (uuid, enum, timestamptz, jsonb, text[]...) */
function literal(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return str(`{${v.map((x) => `"${x.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")}}`);
  }
  if (typeof v === "object") return str(JSON.stringify(v));
  return str(String(v));
}

/** Categorías padre antes que sus hijas */
function sortCategories(rows) {
  const out = [], done = new Set();
  let pending = [...rows];
  while (pending.length) {
    const ready = pending.filter((r) => !r.parent_id || done.has(r.parent_id) || !rows.some((x) => x.id === r.parent_id));
    if (!ready.length) throw new Error("Categorías con referencias circulares.");
    for (const r of ready) { out.push(r); done.add(r.id); }
    pending = pending.filter((r) => !done.has(r.id));
  }
  return out;
}

const IDENTITY = { orders: "number", stock_movements: "id", events: "id" };

const sqlIdx = args.indexOf("--sql");
if (sqlIdx >= 0) {
  const out = args[sqlIdx + 1];
  if (!out) throw new Error("Indica el archivo: --sql restaurar.sql");
  const lines = [`-- Restauración del respaldo del ${backup.created_at}`, "begin;"];
  for (let [table, rows] of Object.entries(backup.tables)) {
    if (!rows.length) continue;
    if (table === "categories") rows = sortCategories(rows);
    const cols = Object.keys(rows[0]);
    lines.push(`\n-- ${table} (${rows.length})`);
    for (let i = 0; i < rows.length; i += 200) {
      const values = rows.slice(i, i + 200).map((r) => `(${cols.map((c) => literal(r[c])).join(", ")})`);
      lines.push(`insert into public.${ident(table)} (${cols.map(ident).join(", ")}) overriding system value values\n${values.join(",\n")}\non conflict do nothing;`);
    }
    // Que los números nuevos sigan después de los restaurados
    if (IDENTITY[table]) {
      const col = IDENTITY[table];
      lines.push(`select setval(pg_get_serial_sequence('public.${table}', '${col}'), coalesce((select max(${ident(col)}) from public.${ident(table)}), 1));`);
    }
  }
  lines.push("\ncommit;");
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  console.log(`\nSQL guardado en ${out}. Ábrelo en el SQL Editor de Supabase y ejecútalo.`);
}

// --- Configuración ----------------------------------------------------------

if (args.includes("--config")) {
  const { adminDb } = await import("../e2e/db.mjs");
  const db = adminDb();
  for (const [name, value] of Object.entries(backup.config ?? {})) {
    if (!args.includes("--aplicar")) { console.log(`[simulación] config/${name}`); continue; }
    const body = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const { error } = await db.storage.from("config").upload(name, body, { upsert: true });
    console.log(error ? `config/${name}: ${error.message}` : `config/${name} restaurado`);
  }
  if (!args.includes("--aplicar")) console.log("Agrega --aplicar para subirlos (reemplazan los actuales).");
}
