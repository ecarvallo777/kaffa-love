"use client";

import { useEffect, useState } from "react";
import type { Catalog } from "@/lib/catalog-types";
import { availability } from "@/lib/catalog-utils";
import { syncLines, useCart } from "@/lib/cart-store";

/**
 * El carrito con precios y stock actualizados según el catálogo.
 * Devuelve avisos cuando algo cambió desde que se agregó.
 */
export function useSyncedCart(catalog: Catalog) {
  const cart = useCart();
  const [notices, setNotices] = useState<string[]>([]);

  useEffect(() => {
    const msgs: string[] = [];
    syncLines((line) => {
      const p = catalog.products.find((x) => x.id === line.productId);
      if (!p) {
        msgs.push(`${line.name} ya no está disponible y lo quitamos del carrito.`);
        return null;
      }
      const { available, maxQty } = availability(p, catalog);
      if (!available) {
        msgs.push(`${p.name} se agotó y lo quitamos del carrito.`);
        return null;
      }
      let qty = line.qty;
      if (maxQty !== null && qty > maxQty) {
        msgs.push(`Solo quedan ${maxQty} de ${p.name}; ajustamos la cantidad.`);
        qty = maxQty;
      }
      if (p.price_clp !== line.priceClp) msgs.push(`El precio de ${p.name} cambió.`);
      return { ...line, name: p.name, slug: p.slug, priceClp: p.price_clp, maxQty, qty };
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- avisos tras sincronizar con el almacenamiento externo
    if (msgs.length) setNotices(msgs);
  }, [catalog]);

  return { ...cart, notices };
}
