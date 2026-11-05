"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Grind } from "@/lib/catalog-types";
import { addToCart } from "@/lib/cart-store";
import { retryPayment } from "./actions";

type Item = { productId: string; name: string; priceClp: number; qty: number; grind: Grind | null };

export function OrderActions({
  orderId,
  status,
  reservedUntil,
  items,
}: {
  orderId: string;
  status: string;
  reservedUntil: string | null;
  items: Item[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const remaining = useCountdown(reservedUntil);

  // Mientras espera el pago, revisa cada pocos segundos si llegó la confirmación
  useEffect(() => {
    if (status !== "pendiente_pago" || !reservedUntil) return;
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [status, reservedUntil, router]);

  if (status === "pendiente_pago" && reservedUntil && remaining > 0) {
    const m = Math.floor(remaining / 60);
    const s = String(remaining % 60).padStart(2, "0");
    return (
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const err = await retryPayment(orderId);
                if (err) setError(err);
              })
            }
            className="inline-flex h-12 items-center rounded-full bg-accent px-6 font-medium text-white hover:bg-accent-deep disabled:opacity-60"
          >
            {pending ? "Conectando…" : "Ir a pagar"}
          </button>
          <span className="text-sm opacity-80 tabular-nums">
            Reserva válida por {m}:{s}
          </span>
        </div>
        {error && <p className="mt-3 text-sm">{error}</p>}
      </div>
    );
  }

  if (status === "expirado" || status === "rechazado" || (status === "pendiente_pago" && remaining <= 0)) {
    return (
      <button
        type="button"
        onClick={() => {
          for (const i of items) {
            addToCart({ productId: i.productId, slug: "", name: i.name, priceClp: i.priceClp, grind: i.grind, maxQty: null }, i.qty);
          }
          router.push("/carrito");
        }}
        className="mt-6 inline-flex h-12 items-center rounded-full bg-paper px-6 font-medium text-ink hover:bg-white"
      >
        Volver a armar mi carrito
      </button>
    );
  }

  return null;
}

function useCountdown(until: string | null) {
  const calc = () => (until ? Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return left;
}
