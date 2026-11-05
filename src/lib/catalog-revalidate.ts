import "server-only";
import { revalidateTag } from "next/cache";

/** El stock o el catálogo cambió: la próxima visita lee datos frescos */
export function refreshCatalog() {
  try {
    revalidateTag("catalog", { expire: 0 });
  } catch (e) {
    // Fuera de un contexto de Next (scripts): no hay caché que invalidar
    console.warn("[catalog] No se pudo invalidar la caché:", (e as Error).message);
  }
}
