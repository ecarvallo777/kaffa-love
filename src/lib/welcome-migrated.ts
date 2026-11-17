import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendPasswordLink } from "@/lib/customer-auth";
import { automationsActive } from "@/lib/automations";

/*
 * Envío programado del correo "Estrenamos tienda" a los clientes migrados de PrestaShop
 * (docs/PRODUCCION.md, 7.2). Lo ejecuta la tarea periódica: solo dentro de la ventana,
 * solo en producción, y una vez por cliente (evento "bienvenida_enviada").
 * El enlace para crear la contraseña vence pronto, por eso se genera al momento de enviar
 * y no antes. Una vez enviado, esta ventana puede borrarse.
 */
const WINDOW_START = new Date("2026-11-17T09:00:00-03:00");
const WINDOW_END = new Date("2026-11-17T12:00:00-03:00");
const MAX_PER_RUN = 30;

export async function runMigratedWelcomeEmails(now = new Date()) {
  if (!automationsActive() || now < WINDOW_START || now >= WINDOW_END) return 0;
  const db = createAdminClient();

  const { data: customers, error } = await db
    .from("customers")
    .select("id, email")
    .eq("source", "prestashop")
    .is("auth_user_id", null)
    .lt("created_at", WINDOW_START.toISOString());
  if (error) throw new Error(error.message);
  if (!customers?.length) return 0;

  const { data: sent } = await db
    .from("events")
    .select("entity_id")
    .eq("type", "bienvenida_enviada")
    .in("entity_id", customers.map((c) => c.id));
  const done = new Set((sent ?? []).map((e) => e.entity_id));

  let count = 0;
  for (const c of customers.filter((c) => !done.has(c.id)).slice(0, MAX_PER_RUN)) {
    if (!(await sendPasswordLink(c.email, "bienvenida"))) {
      console.error("[bienvenida] No se pudo enviar a un cliente migrado:", c.id);
      continue;
    }
    await logEvent("bienvenida_enviada", "customer", c.id, { origen: "prestashop" });
    count++;
    // Resend admite pocas solicitudes por segundo
    await new Promise((r) => setTimeout(r, 600));
  }
  return count;
}
