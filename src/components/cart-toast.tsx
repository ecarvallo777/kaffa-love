"use client";

import { useEffect } from "react";
import { cartCount, dismissLastAdded, useCart } from "@/lib/cart-store";
import { clp } from "@/lib/catalog-utils";
import { grindLabel } from "@/lib/grinds";

/** Aviso breve al agregar al carrito */
export function CartToast() {
  const { lines, lastAdded } = useCart();

  useEffect(() => {
    if (!lastAdded) return;
    const t = setTimeout(dismissLastAdded, 4500);
    return () => clearTimeout(t);
  }, [lastAdded]);

  if (!lastAdded) return null;
  const { line, added, at } = lastAdded;
  const count = cartCount(lines);
  const grind = grindLabel(line.grind);

  return (
    <div
      key={at}
      role="status"
      className="fixed inset-x-3 bottom-24 z-50 animate-toast sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96 md:bottom-6"
    >
      <div className="rounded-2xl bg-ink p-4 text-paper shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-leaf">
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-paper/70">
              {added > 0 ? "Agregado al carrito" : "Ya tienes el máximo disponible"}
            </p>
            <p className="mt-0.5 font-display text-lg leading-snug">{line.name}</p>
            <p className="mt-0.5 text-sm text-paper/70">
              {[grind && `Molienda ${grind.toLowerCase()}`, `${line.qty} × ${clp(line.priceClp)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissLastAdded}
            className="-m-1 rounded-full p-1 text-paper/60 hover:text-paper"
            aria-label="Cerrar aviso"
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-paper/15 pt-3 text-sm">
          <span className="text-paper/70">
            {count} {count === 1 ? "producto" : "productos"} en tu carrito
          </span>
          <button type="button" onClick={dismissLastAdded} className="font-medium underline-offset-4 hover:underline">
            Seguir comprando
          </button>
        </div>
      </div>
    </div>
  );
}
