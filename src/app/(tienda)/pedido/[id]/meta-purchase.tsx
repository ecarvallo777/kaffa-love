"use client";

import { useEffect } from "react";
import { metaEvent } from "@/lib/meta-events";

/** Compra para el píxel de Meta, una vez por pedido (mismo id que el envío del servidor: Meta la cuenta una vez) */
export function MetaPurchase({ orderId, value, items }: { orderId: string; value: number; items: { id: string; quantity: number; price: number }[] }) {
  useEffect(() => {
    const key = `kaffa-meta-compra-${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    metaEvent(
      "Purchase",
      {
        currency: "CLP",
        value,
        content_type: "product",
        content_ids: [...new Set(items.map((i) => i.id))],
        contents: items.map((i) => ({ id: i.id, quantity: i.quantity, item_price: i.price })),
        num_items: items.reduce((s, i) => s + i.quantity, 0),
      },
      `compra-${orderId}`,
    );
  }, [orderId, value, items]);
  return null;
}
