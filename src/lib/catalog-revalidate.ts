import "server-only";
import { revalidateTag } from "next/cache";

/**
 * El stock o el catálogo cambió: se regenera en segundo plano (la próxima
 * visita puede ver el dato anterior un instante; el stock real se valida
 * siempre al pagar).
 */
export function refreshCatalog() {
  try {
    revalidateTag("catalog", "max");
  } catch (e) {
    // Fuera de un contexto de Next (scripts): no hay caché que invalidar
    console.warn("[catalog] No se pudo invalidar la caché:", (e as Error).message);
  }
}
