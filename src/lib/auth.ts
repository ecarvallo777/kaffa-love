import "server-only";
import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffRole = "admin" | "operador";
export type Staff = { userId: string; email: string; name: string; role: StaffRole };

/** Persona del equipo conectada, o null. Verifica el token con Supabase. */
export async function getStaff(): Promise<Staff | null> {
  const auth = await createAuthClient();
  // getClaims verifica la firma del token (localmente si el proyecto usa claves asimétricas)
  const { data: claims } = await auth.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await createAdminClient()
    .from("staff")
    .select("name, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  return { userId, email: String(claims.claims.email ?? ""), name: data.name, role: data.role };
}

/**
 * Exige una sesión del equipo con alguno de los roles. Usar en cada página
 * y en cada Server Action de administración o feria.
 */
export async function requireStaff(roles: StaffRole[] = ["admin"], next = "/admin") {
  const staff = await getStaff();
  if (!staff) redirect(`/ingresar?next=${encodeURIComponent(next)}`);
  if (!roles.includes(staff.role)) {
    redirect(staff.role === "operador" ? "/feria" : "/ingresar?error=permiso");
  }
  return staff;
}
