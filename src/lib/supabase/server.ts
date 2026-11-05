import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente con la sesión del usuario (cookies). Solo se usa para saber
 * QUIÉN está conectado; los datos se leen con el cliente admin después
 * de verificar sus permisos.
 */
export async function createAuthClient() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: el proxy ya renueva la sesión
          }
        },
      },
    },
  );
}
