"use server";

import { getCustomer } from "@/lib/customer-auth";
import { loadServerCart, mergeLines, sanitizeLines, saveServerCart, type StoredCartLine } from "@/lib/server-cart";

export type SyncResult = { customerId: string | null; lines: StoredCartLine[] };

/**
 * Sincroniza el carrito del navegador con el de la cuenta.
 * - Sin sesión: no hace nada.
 * - Carrito del navegador ya asociado a esta cuenta: manda lo guardado en el servidor
 *   (así lo que se quitó en otro dispositivo también desaparece aquí).
 * - Carrito armado sin sesión: se combina con el guardado.
 * - Carrito de otra cuenta: se descarta y se usa el de esta cuenta.
 */
export async function syncCart(localInput: unknown, owner: string | null, dirty = false): Promise<SyncResult> {
  const customer = await getCustomer();
  if (!customer) return { customerId: null, lines: [] };

  // Cambios hechos en este navegador que aún no alcanzaron a guardarse: mandan ellos
  if (owner === customer.id && dirty) {
    const local = sanitizeLines(localInput);
    await saveServerCart(customer.id, local);
    return { customerId: customer.id, lines: local };
  }

  const server = await loadServerCart(customer.id);
  if (owner === customer.id) return { customerId: customer.id, lines: server };
  if (owner) return { customerId: customer.id, lines: server };

  const merged = mergeLines(server, sanitizeLines(localInput));
  await saveServerCart(customer.id, merged);
  return { customerId: customer.id, lines: merged };
}

/** Guarda el carrito de la cuenta (después de cada cambio en el navegador) */
export async function saveCart(input: unknown): Promise<boolean> {
  const customer = await getCustomer();
  if (!customer) return false;
  await saveServerCart(customer.id, sanitizeLines(input));
  return true;
}
