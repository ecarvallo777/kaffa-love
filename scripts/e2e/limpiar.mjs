// Borra los pedidos y clientes de prueba (correos @kaffalove.test) y
// devuelve su stock. Uso: node scripts/e2e/limpiar.mjs
import { adminDb } from "./db.mjs";

const db = adminDb();
const { data: customers } = await db.from("customers").select("id, email").like("email", "%@kaffalove.test");
const customerIds = (customers ?? []).map((c) => c.id);

// Solo pedidos de clientes de prueba (nunca ventas reales)
const { data: orders } = customerIds.length
  ? await db.from("orders").select("id, number, status").in("customer_id", customerIds)
  : { data: [] };

// Solo jornadas de feria de prueba
const { data: testSessions } = await db.from("fair_sessions").select("id").like("name", "[PRUEBA]%");
const testSessionIds = new Set((testSessions ?? []).map((s) => s.id));
const { data: fairOrders } = testSessionIds.size
  ? await db.from("orders").select("id, number, status").in("fair_session_id", [...testSessionIds])
  : { data: [] };

const all = [...(orders ?? []), ...(fairOrders ?? [])];
const seen = new Set();
for (const o of all) {
  if (seen.has(o.id)) continue;
  seen.add(o.id);
  const { error } = await db.rpc("release_order_stock", { p_order_id: o.id });
  if (error) console.error(`No se pudo liberar ${o.number}:`, error.message);
  await db.from("stock_movements").delete().eq("order_id", o.id);
  await db.from("events").delete().eq("entity_id", o.id);
  await db.from("orders").delete().eq("id", o.id);
  console.log(`Pedido #${o.number} (${o.status}) eliminado`);
}

// Movimientos manuales de prueba (ajustes, inicio de jornada): se revierten
const { data: testMoves } = await db.from("stock_movements").select("id, product_id, delta").like("note", "%[PRUEBA]%");
const net = new Map();
for (const m of testMoves ?? []) net.set(m.product_id, (net.get(m.product_id) ?? 0) + m.delta);
for (const [productId, delta] of net) {
  if (!delta) continue;
  const { data: p } = await db.from("products").select("stock, name").eq("id", productId).single();
  await db.from("products").update({ stock: Math.max(0, p.stock - delta) }).eq("id", productId);
  console.log(`${p.name}: stock ${p.stock} → ${Math.max(0, p.stock - delta)}`);
}
if (testMoves?.length) {
  await db.from("stock_movements").delete().in("id", testMoves.map((m) => m.id));
  await db.from("events").delete().eq("type", "stock_ajustado").like("data->>nota", "%[PRUEBA]%");
}

if (testSessionIds.size) {
  // Gastos ingresados para jornadas de prueba
  const { data: file } = await db.storage.from("config").download("gastos-ferias.json");
  if (file) {
    const all = JSON.parse(await file.text());
    for (const id of testSessionIds) delete all[id];
    const body = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    if (Object.keys(all).length) await db.storage.from("config").upload("gastos-ferias.json", body, { upsert: true });
    else await db.storage.from("config").remove(["gastos-ferias.json"]);
  }
  await db.from("events").delete().in("entity_id", [...testSessionIds]);
  await db.from("fair_sessions").delete().in("id", [...testSessionIds]);
  console.log(`${testSessionIds.size} jornada(s) de prueba eliminada(s)`);
}

// Recetas de prueba (título con [PRUEBA]); las demás no se tocan
{
  const { data: file } = await db.storage.from("config").download("recetas.json");
  if (file) {
    const all = JSON.parse(await file.text());
    const keep = all.filter((r) => !String(r.title).includes("[PRUEBA]"));
    if (keep.length !== all.length) {
      const body = new Blob([JSON.stringify(keep, null, 2)], { type: "application/json" });
      await db.storage.from("config").upload("recetas.json", body, { upsert: true });
      console.log(`${all.length - keep.length} receta(s) de prueba eliminada(s)`);
    }
  }
}

// Usuarios de prueba (solo con --usuarios)
if (process.argv.includes("--usuarios")) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of list.users.filter((u) => u.email?.endsWith("@kaffalove.test"))) {
    await db.from("staff").delete().eq("user_id", u.id);
    await db.auth.admin.deleteUser(u.id);
    console.log(`Usuario ${u.email} eliminado`);
  }
}

if (customerIds.length) {
  // Cuentas de cliente creadas en las pruebas
  const { data: withAuth } = await db.from("customers").select("auth_user_id").in("id", customerIds).not("auth_user_id", "is", null);
  for (const c of withAuth ?? []) await db.auth.admin.deleteUser(c.auth_user_id);
  // Carritos guardados de esas cuentas
  await db.storage.from("carritos").remove(customerIds.map((id) => `${id}.json`)).catch(() => {});
  await db.from("addresses").delete().in("customer_id", customerIds);
  await db.from("customers").delete().in("id", customerIds);
  console.log(`${customerIds.length} cliente(s) de prueba eliminado(s)`);
}
console.log("Listo.");
