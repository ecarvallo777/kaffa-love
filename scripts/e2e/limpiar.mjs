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

if (testSessionIds.size) {
  await db.from("stock_movements").delete().like("note", "[PRUEBA]%");
  await db.from("events").delete().in("entity_id", [...testSessionIds]);
  await db.from("fair_sessions").delete().in("id", [...testSessionIds]);
  console.log(`${testSessionIds.size} jornada(s) de prueba eliminada(s)`);
}

if (customerIds.length) {
  await db.from("addresses").delete().in("customer_id", customerIds);
  await db.from("customers").delete().in("id", customerIds);
  console.log(`${customerIds.length} cliente(s) de prueba eliminado(s)`);
}
console.log("Listo.");
