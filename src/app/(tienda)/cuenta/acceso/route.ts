import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/server";
import { readAccessToken } from "@/lib/customer-cart-link";
import { logEvent } from "@/lib/events";

/**
 * Enlace del correo «Tu pedido está listo» (Admin → Clientes): entra a la cuenta del
 * cliente sin contraseña y lo deja en el pago con su carrito. Vale 7 días.
 */
export async function GET(request: NextRequest) {
  const back = (reason: string) => NextResponse.redirect(new URL(`/cuenta?acceso=${reason}`, request.url));
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const r = readAccessToken(token);
  if ("error" in r) return back(r.error);

  const db = createAdminClient();
  const { data: c } = await db.from("customers").select("id, email").eq("id", r.customerId).maybeSingle();
  if (!c) return back("invalido");

  // Enlace de un solo uso generado en el momento, verificado aquí mismo: deja la sesión en las cookies
  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email: c.email });
  if (error || !data.properties?.hashed_token) return back("error");
  const auth = await createAuthClient();
  let { error: verifyError } = await auth.auth.verifyOtp({ type: "email", token_hash: data.properties.hashed_token });
  if (verifyError) ({ error: verifyError } = await auth.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token }));
  if (verifyError) return back("error");

  await db.from("customers").update({ auth_user_id: data.user.id }).eq("id", c.id).is("auth_user_id", null);
  await logEvent("acceso_carrito", "customer", c.id, {});
  return NextResponse.redirect(new URL("/checkout", request.url));
}
