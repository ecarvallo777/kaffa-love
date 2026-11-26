import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { loadServerCart, saveServerCart } from "@/lib/server-cart";

/*
 * Derechos de los titulares (Ley 21.719): acceso y portabilidad (exportar) y supresión (eliminar).
 * Se atienden desde Admin → Clientes cuando un cliente lo pide por correo; la ley da 30 días
 * corridos para responder. Cada atención queda registrada en `events` (sin datos personales).
 *
 * La supresión borra nombre, correo, teléfono, direcciones, cuenta y carrito, pero conserva los
 * pedidos (montos, productos, comuna) porque la ley tributaria obliga a guardar el respaldo de
 * las ventas por 6 años: quedan a nombre de «Cliente eliminado».
 */

const ACTIVE = ["pendiente_pago", "pagado", "en_preparacion", "despachado", "listo_retiro"];

export async function exportCustomerData(customerId: string, by: string) {
  const db = createAdminClient();
  const [{ data: customer }, { data: addresses }, { data: orders }, cart] = await Promise.all([
    db.from("customers").select("email, name, phone, marketing_consent, marketing_consent_at, created_at, auth_user_id").eq("id", customerId).maybeSingle(),
    db.from("addresses").select("street, number, apartment, commune, region, notes, created_at").eq("customer_id", customerId),
    db
      .from("orders")
      .select("number, channel, status, delivery, shipping_address, subtotal_clp, shipping_clp, total_clp, created_at, paid_at, tracking_number, order_items (product_name, quantity, unit_price_clp, grind)")
      .eq("customer_id", customerId)
      .order("created_at"),
    loadServerCart(customerId).catch(() => null),
  ]);
  if (!customer) throw new Error("No encontramos al cliente.");
  await logEvent("datos_exportados", "customer", customerId, { por: by });
  return {
    responsable: "Kaffa Love SpA (RUT 78.181.139-4) · contacto@kaffalove.cl",
    generado: new Date().toISOString(),
    datos_de_contacto: {
      correo: customer.email,
      nombre: customer.name,
      telefono: customer.phone,
      cliente_desde: customer.created_at,
      tiene_cuenta: !!customer.auth_user_id,
      acepta_novedades: customer.marketing_consent,
      novedades_aceptadas_el: customer.marketing_consent_at,
    },
    direcciones: addresses ?? [],
    pedidos: (orders ?? []).map((o) => ({
      numero: o.number,
      canal: o.channel,
      estado: o.status,
      entrega: o.delivery,
      direccion: o.shipping_address,
      productos: o.order_items,
      subtotal_clp: o.subtotal_clp,
      envio_clp: o.shipping_clp,
      total_clp: o.total_clp,
      creado: o.created_at,
      pagado: o.paid_at,
      seguimiento: o.tracking_number,
    })),
    carrito_guardado: cart ?? [],
  };
}

export async function deleteCustomerData(customerId: string, by: string) {
  const db = createAdminClient();
  const { data: customer } = await db.from("customers").select("id, email, auth_user_id").eq("id", customerId).maybeSingle();
  if (!customer) throw new Error("No encontramos al cliente.");
  if (customer.email.endsWith("@kaffalove.invalid")) throw new Error("Los datos de este cliente ya fueron eliminados.");

  const { data: active } = await db.from("orders").select("number").eq("customer_id", customerId).in("status", ACTIVE);
  if (active?.length) throw new Error(`Tiene pedidos en curso (${active.map((o) => `#${o.number}`).join(", ")}). Elimina sus datos cuando estén entregados o cancelados.`);

  if (customer.auth_user_id) {
    const { error } = await db.auth.admin.deleteUser(customer.auth_user_id);
    if (error && !/not.?found/i.test(error.message)) throw new Error(`No se pudo borrar su cuenta: ${error.message}`);
  }

  // Pedidos: solo se conserva la comuna y región (para reportes y respaldo tributario)
  const { data: orders } = await db.from("orders").select("id, shipping_address").eq("customer_id", customerId);
  for (const o of orders ?? []) {
    if (!o.shipping_address) continue;
    const a = o.shipping_address as { commune?: string; region?: string };
    await db.from("orders").update({ shipping_address: { commune: a.commune ?? null, region: a.region ?? null } }).eq("id", o.id);
  }
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length) await db.from("events").delete().eq("type", "meta_atribucion").in("entity_id", orderIds);

  await db.from("addresses").delete().eq("customer_id", customerId);
  await saveServerCart(customerId, []).catch(() => {});
  const { error } = await db
    .from("customers")
    .update({ email: `eliminado-${customerId}@kaffalove.invalid`, name: "Cliente eliminado", phone: null, auth_user_id: null, marketing_consent: false, marketing_consent_at: null })
    .eq("id", customerId);
  if (error) throw new Error(error.message);

  await logEvent("datos_suprimidos", "customer", customerId, { pedidos_conservados: orderIds.length, por: by });
  return { orders: orderIds.length };
}

/**
 * Minimización: la IP y el navegador guardados para atribuir compras a los anuncios de Meta
 * solo sirven unos días (Meta no acepta compras de más de 7 días). Se borran a los 30.
 */
export async function purgeOldAttribution(now = new Date()) {
  const before = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const { data, error } = await createAdminClient().from("events").delete().eq("type", "meta_atribucion").lt("created_at", before).select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
