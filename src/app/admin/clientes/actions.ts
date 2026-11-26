"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { sendCartEmail, setCustomerCart, type CartItemInput } from "@/lib/customer-cart-link";
import { deleteCustomerData } from "@/lib/privacy-requests";
import type { ActionResult } from "@/components/admin/action-form";

const GRINDS = ["grano", "fina", "media", "gruesa"];

/** Cliente nuevo (por ejemplo, alguien que pidió por WhatsApp o en la feria) */
export async function createCustomerAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim() || null;
  const phone = String(form.get("phone") ?? "").trim() || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Revisa el correo." };
  const db = createAdminClient();
  const { data: existing } = await db.from("customers").select("id").eq("email", email).maybeSingle();
  if (existing) redirect(`/admin/clientes/${existing.id}?ya=1`);
  const { data, error } = await db.from("customers").insert({ email, name, phone }).select("id").single();
  if (error) return { error: error.message };
  await logEvent("cliente_creado", "customer", data.id, { por: staff.email });
  redirect(`/admin/clientes/${data.id}`);
}

export async function saveCustomerCartAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const customerId = String(form.get("customerId") ?? "");
  let items: CartItemInput[];
  try {
    items = (JSON.parse(String(form.get("items") ?? "[]")) as CartItemInput[]).map((i) => ({
      productId: String(i.productId),
      qty: Number(i.qty),
      grind: GRINDS.includes(String(i.grind)) ? (i.grind as CartItemInput["grind"]) : null,
    }));
  } catch {
    return { error: "No se pudo leer el carrito." };
  }
  if (items.some((i) => !i.productId)) return { error: "Elige el producto de cada línea." };
  try {
    const lines = await setCustomerCart(customerId, items);
    await logEvent("carrito_preparado", "customer", customerId, { lineas: lines.length, unidades: lines.reduce((s, l) => s + l.qty, 0), por: staff.email });
  } catch (e) {
    return { error: (e as Error).message };
  }
  refresh();
  return { ok: items.length ? "Carrito guardado. Ahora puedes enviárselo." : "Carrito vaciado." };
}

export async function sendCartAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const customerId = String(form.get("customerId") ?? "");
  try {
    const r = await sendCartEmail(customerId, String(form.get("note") ?? "").slice(0, 1000));
    await logEvent("carrito_enviado", "customer", customerId, { lineas: r.lines, subtotal: r.total, por: staff.email });
    refresh();
    return { ok: `Correo enviado a ${r.email}. Con el botón entra directo a pagar (vale 7 días).` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** Derecho de supresión (Ley 21.719): borra los datos personales y conserva los pedidos anonimizados */
export async function deleteCustomerDataAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "ELIMINAR") return { error: "Escribe ELIMINAR para confirmar." };
  try {
    const r = await deleteCustomerData(String(form.get("id")), staff.email);
    refresh();
    return { ok: `Datos eliminados. Se conservaron ${r.orders} pedidos a nombre de «Cliente eliminado» (respaldo tributario). Avísale al cliente por correo que su solicitud fue atendida.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
