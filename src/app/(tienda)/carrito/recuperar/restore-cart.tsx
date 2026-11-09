"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { Grind } from "@/lib/catalog-types";
import { addToCart, getCartLines } from "@/lib/cart-store";
import { track } from "@/lib/track";

type Item = { productId: string; name: string; priceClp: number; qty: number; grind: Grind | null };

export function RestoreCart({ items, origen }: { items: Item[]; origen: "abandono" | "recompra" }) {
  const router = useRouter();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !items.length) return;
    done.current = true;
    const inCart = new Set(getCartLines().map((l) => l.key));
    for (const i of items) {
      // Si ya está en el carrito (por ejemplo, recargó la página), no se duplica
      if (inCart.has(`${i.productId}:${i.grind ?? "-"}`)) continue;
      addToCart({ productId: i.productId, slug: "", name: i.name, priceClp: i.priceClp, grind: i.grind, maxQty: null }, i.qty);
    }
    track("recupero_carrito", { origen, items: items.length });
    router.replace("/carrito");
  }, [items, origen, router]);

  if (!items.length) {
    return (
      <>
        <p className="font-display text-3xl">No encontramos ese pedido</p>
        <p className="mt-2 text-ink-soft">Puede que el enlace haya cambiado. Te esperamos en la tienda.</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper hover:bg-accent">
          Ir a la tienda
        </Link>
      </>
    );
  }
  return <p className="text-ink-soft">Preparando tu carrito…</p>;
}
