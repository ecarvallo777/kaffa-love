"use client";

import { useRouter } from "next/navigation";
import type { Grind } from "@/lib/catalog-types";
import { addToCart } from "@/lib/cart-store";

type Item = { productId: string; name: string; priceClp: number; qty: number; grind: Grind | null };

/** Agrega al carrito lo mismo de un pedido anterior (precios y stock se actualizan en el carrito) */
export function ReorderButton({ items }: { items: Item[] }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        for (const i of items) addToCart({ productId: i.productId, slug: "", name: i.name, priceClp: i.priceClp, grind: i.grind, maxQty: null }, i.qty);
        router.push("/carrito");
      }}
      className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-ink"
    >
      Volver a comprar
    </button>
  );
}
