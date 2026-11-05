import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave secreta: salta las reglas de seguridad.
 * Solo para código de servidor que ya verificó los permisos de quien llama
 * (pedidos, stock, administración). Nunca debe llegar al navegador;
 * "server-only" hace fallar la compilación si alguien lo importa ahí.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
