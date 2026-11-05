"use server";

import { refresh } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { getOrder, notifyStatusChange } from "@/lib/orders";
import { refreshCatalog } from "@/lib/catalog-revalidate";
import type { ActionResult } from "@/components/admin/action-form";

/** Cambios de estado permitidos para pedidos online */
const NEXT: Record<string, string[]> = {
  pagado: ["en_preparacion", "despachado", "listo_retiro", "cancelado"],
  en_preparacion: ["despachado", "listo_retiro", "cancelado"],
  despachado: ["entregado"],
  listo_retiro: ["entregado", "cancelado"],
  pendiente_pago: ["cancelado"],
};

export async function changeOrderStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const orderId = String(form.get("orderId"));
  const status = String(form.get("status"));
  const tracking = String(form.get("tracking") ?? "").trim();

  const order = await getOrder(orderId);
  if (!order) return { error: "Pedido no encontrado." };
  if (!NEXT[order.status]?.includes(status)) return { error: "Ese cambio de estado no está permitido." };
  if (status === "despachado" && order.delivery !== "despacho") return { error: "Este pedido es para retiro." };
  if (status === "listo_retiro" && order.delivery !== "retiro") return { error: "Este pedido es para despacho." };

  const db = createAdminClient();

  if (status === "cancelado") {
    // Devuelve el stock reservado o vendido (es seguro llamarlo más de una vez)
    const { error } = await db.rpc("release_order_stock", { p_order_id: orderId });
    if (error) return { error: `No se pudo devolver el stock: ${error.message}` };
    refreshCatalog();
  }

  const { error } = await db
    .from("orders")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "despachado" && tracking ? { tracking_number: tracking } : {}),
      ...(status === "cancelado" ? { reserved_until: null } : {}),
    })
    .eq("id", orderId)
    .eq("status", order.status);
  if (error) return { error: error.message };

  await logEvent(status === "cancelado" ? "pedido_cancelado" : "estado_cambiado", "order", orderId, {
    de: order.status,
    a: status,
    por: staff.email,
    ...(tracking ? { tracking } : {}),
  });
  if (status === "despachado" || status === "listo_retiro") {
    await notifyStatusChange({ ...order, tracking_number: tracking || order.tracking_number }, status);
  }

  refresh();
  const paidAndCancelled = status === "cancelado" && order.status !== "pendiente_pago";
  return {
    ok: paidAndCancelled
      ? "Pedido cancelado y stock devuelto. Recuerda hacer la devolución del dinero desde Mercado Pago."
      : "Estado actualizado.",
  };
}

export async function saveTracking(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const orderId = String(form.get("orderId"));
  const tracking = String(form.get("tracking") ?? "").trim();
  const { error } = await createAdminClient().from("orders").update({ tracking_number: tracking || null, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) return { error: error.message };
  await logEvent("estado_cambiado", "order", orderId, { tracking, por: staff.email });
  refresh();
  return { ok: "Número de seguimiento guardado." };
}
