"use client";

import Link from "next/link";
import { cartCount, useCart } from "@/lib/cart-store";

export function CartButton() {
  const { lines, lastAdded } = useCart();
  const count = cartCount(lines);

  return (
    <Link
      href="/carrito"
      className="relative inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors hover:bg-paper-2"
      aria-label={`Carrito, ${count} ${count === 1 ? "producto" : "productos"}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" strokeLinejoin="round" />
        <path d="M9 8V6.5a3 3 0 0 1 6 0V8" strokeLinecap="round" />
      </svg>
      <span className="hidden sm:inline">Carrito</span>
      <span
        key={lastAdded?.at ?? 0}
        className={`grid min-w-5 place-items-center rounded-full px-1.5 text-xs tabular-nums ${
          count ? "animate-bump bg-accent text-white" : "bg-paper-3 text-ink-soft"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}
