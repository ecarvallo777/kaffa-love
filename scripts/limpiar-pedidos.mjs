// Borra TODOS los pedidos y jornadas de feria y deja el stock en lo contado/configurado.
// Uso: node scripts/limpiar-pedidos.mjs            -> muestra el plan, no cambia nada
//      node scripts/limpiar-pedidos.mjs --aplicar  -> aplica la limpieza
import { adminDb } from "./e2e/db.mjs";

const db = adminDb();
const APPLY = process.argv.includes("--aplicar");
const { data: orders } = await db.from("orders").select("id, number");
const { data: sessions } = await db.from("fair_sessions").select("id, name");
const { data: prods } = await db.from("products").select("id, name, stock").eq("track_stock", true);
const { data: mov } = await db.from("stock_movements").select("id, product_id, delta, reason, order_id, note, created_at").order("created_at");
console.log(`Pedidos a borrar: ${orders.length} · Jornadas a borrar: ${sessions.length} (${sessions.map((s) => s.name).join(", ")})`);

const plan = [];
for (const p of prods) {
  // Movimientos que no vienen de pedidos ni de jornadas (stock inicial, conteos, compras)
  const keep = mov.filter((m) => m.product_id === p.id && !m.order_id && m.reason !== "inicio_jornada");
  // Si hubo un conteo de inventario, manda lo contado (físico); si no, lo configurado
  const lastCount = [...keep].reverse().find((m) => /contado (\d+)/.test(m.note ?? ""));
  const sumKeep = keep.reduce((s, m) => s + m.delta, 0);
  const target = lastCount
    ? Number(/contado (\d+)/.exec(lastCount.note)[1]) + keep.filter((m) => m.created_at > lastCount.created_at).reduce((s, m) => s + m.delta, 0)
    : sumKeep;
  plan.push({ p, target, fix: target - sumKeep });
}
for (const x of plan.sort((a, b) => a.p.name.localeCompare(b.p.name))) console.log(`  ${x.p.name}: ${x.p.stock} → ${x.target}`);
if (!APPLY) {
  console.log("\nNo se cambió nada. Para aplicar: node scripts/limpiar-pedidos.mjs --aplicar");
  process.exit(0);
}

const chk = (r, what) => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
};
const oids = orders.map((o) => o.id);
const sids = sessions.map((s) => s.id);
chk(await db.from("stock_movements").delete().not("order_id", "is", null), "movimientos de pedidos");
chk(await db.from("stock_movements").delete().eq("reason", "inicio_jornada"), "movimientos de jornadas");
for (let i = 0; i < oids.length; i += 50) chk(await db.from("events").delete().in("entity_id", oids.slice(i, i + 50)), "eventos de pedidos");
if (sids.length) chk(await db.from("events").delete().in("entity_id", sids), "eventos de jornadas");
if (oids.length) chk(await db.from("orders").delete().in("id", oids), "pedidos");
if (sids.length) chk(await db.from("fair_sessions").delete().in("id", sids), "jornadas");
const { data: gastos } = await db.storage.from("config").download("gastos-ferias.json");
if (gastos) await db.storage.from("config").remove(["gastos-ferias.json"]);
for (const x of plan) {
  chk(await db.from("products").update({ stock: x.target, updated_at: new Date().toISOString() }).eq("id", x.p.id), x.p.name);
  if (x.fix) {
    chk(
      await db.from("stock_movements").insert({ product_id: x.p.id, delta: x.fix, reason: "ajuste", note: "Limpieza: se eliminaron los pedidos y jornadas de prueba" }),
      x.p.name,
    );
  }
}
const { count } = await db.from("orders").select("id", { count: "exact", head: true });
console.log(`\nListo. Pedidos restantes: ${count}. El stock de la tienda se actualiza en unos minutos.`);
