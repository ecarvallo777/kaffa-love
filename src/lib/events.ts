import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Registra un hecho del negocio. Es la materia prima de reportes y agentes,
 * así que nunca debe romper la operación: si falla, solo se informa en el log.
 * Se guarda en orden, antes de responder, para que el historial sea exacto.
 */
export async function logEvent(
  type: string,
  entity: string,
  entityId: string | null,
  data: Record<string, unknown> = {},
) {
  const { error } = await createAdminClient()
    .from("events")
    .insert({ type, entity, entity_id: entityId, data });
  if (error) console.error(`[events] No se pudo registrar ${type}:`, error.message);
}

/** Igual que logEvent, pero se guarda después de responder (para operaciones rápidas como la feria) */
export function logEventLater(...args: Parameters<typeof logEvent>) {
  try {
    after(() => logEvent(...args));
  } catch {
    void logEvent(...args);
  }
}

/** Eventos que requieren que alguien del equipo revise algo */
export const ATTENTION_EVENTS = [
  "pago_tardio",
  "pago_duplicado",
  "pago_monto_distinto",
  "pago_reembolsado",
] as const;
