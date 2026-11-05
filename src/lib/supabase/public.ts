import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la clave pública. Solo puede leer lo que las reglas de
 * seguridad (RLS) permiten: el catálogo visible y los lugares de retiro.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
