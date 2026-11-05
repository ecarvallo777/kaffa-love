"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Grind } from "@/lib/catalog-types";
import { addToCart } from "@/lib/cart-store";
import { clp } from "@/lib/catalog-utils";
import { GRINDS } from "@/lib/grinds";
import { GrindGlyph } from "@/components/grind-glyph";

type Props = {
  product: { id: string; slug: string; name: string; priceClp: number; isCoffee: boolean };
  available: boolean;
  maxQty: number | null;
};

export function AddToCart({ product, available, maxQty }: Props) {
  const [grind, setGrind] = useState<Grind | null>(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [mainVisible, setMainVisible] = useState(true);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const errorId = useId();

  const limit = maxQty ?? 20;
  const total = product.priceClp * qty;

  // Barra fija en móvil cuando el botón principal sale de la pantalla
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setMainVisible(e.isIntersecting), {
      rootMargin: "0px 0px -40px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function submit() {
    if (!available) return;
    if (product.isCoffee && !grind) {
      setError(true);
      setShakeKey((k) => k + 1);
      fieldsetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      fieldsetRef.current?.querySelector("input")?.focus({ preventScroll: true });
      return;
    }
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        priceClp: product.priceClp,
        grind: product.isCoffee ? grind : null,
        maxQty,
      },
      qty,
    );
    setQty(1);
  }

  return (
    <div>
      {product.isCoffee && (
        <fieldset
          ref={fieldsetRef}
          key={shakeKey}
          className={shakeKey ? "animate-shake" : ""}
          aria-describedby={error ? errorId : undefined}
          disabled={!available}
        >
          <legend className="flex w-full items-baseline justify-between">
            <span className="text-sm font-medium">
              Molienda <span className="font-normal text-ink-mute">· elige una</span>
            </span>
            <a href="#guia-molienda" className="text-sm text-ink-soft underline decoration-line underline-offset-4 hover:text-ink">
              ¿Cuál elijo?
            </a>
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRINDS.map((g) => (
              <label
                key={g.value}
                className={`group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                  grind === g.value
                    ? "border-ink bg-ink text-paper shadow-md"
                    : error
                      ? "border-accent/60 bg-paper hover:border-ink"
                      : "border-line bg-paper hover:border-ink"
                }`}
              >
                <input
                  type="radio"
                  name="grind"
                  value={g.value}
                  checked={grind === g.value}
                  onChange={() => {
                    setGrind(g.value);
                    setError(false);
                  }}
                  className="sr-only"
                />
                <GrindGlyph
                  grind={g.value}
                  className={`size-8 ${grind === g.value ? "text-crema" : "text-ink-soft"}`}
                />
                <span className="text-sm leading-none font-medium">{g.label}</span>
                <span
                  className={`text-xs leading-snug ${grind === g.value ? "text-paper/70" : "text-ink-mute"}`}
                >
                  {g.methods}
                </span>
              </label>
            ))}
          </div>
          {error && (
            <p id={errorId} className="mt-2 text-sm text-accent" role="alert">
              Elige una molienda para agregar este café.
            </p>
          )}
        </fieldset>
      )}

      <div ref={mainRef} className="mt-6 flex gap-3">
        <QtyStepper qty={qty} setQty={setQty} limit={limit} disabled={!available} />
        <button
          type="button"
          onClick={submit}
          disabled={!available}
          className="flex h-13 flex-1 items-center justify-between gap-3 rounded-full bg-accent px-6 font-medium text-white shadow-[0_8px_20px_-8px_rgba(180,67,44,0.7)] transition-all hover:bg-accent-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-ink-mute disabled:shadow-none"
        >
          <span className="whitespace-nowrap">
            {available ? (
              <>
                Agregar<span className="max-[400px]:hidden"> al carrito</span>
              </>
            ) : (
              "Agotado"
            )}
          </span>
          {available && <span className="tabular-nums opacity-90">{clp(total)}</span>}
        </button>
      </div>

      {/* Barra fija en móvil */}
      {available && (
        <div
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur transition-transform duration-300 md:hidden ${
            mainVisible ? "translate-y-full" : "translate-y-0"
          }`}
          aria-hidden={mainVisible}
        >
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{product.name}</p>
              <p className="text-sm text-ink-soft tabular-nums">
                {clp(total)}
                {product.isCoffee && (
                  <span className="text-ink-mute">
                    {" "}
                    · {grind ? GRINDS.find((g) => g.value === grind)?.label : "elige molienda"}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={submit}
              tabIndex={mainVisible ? -1 : 0}
              className="h-11 shrink-0 rounded-full bg-accent px-5 text-sm font-medium text-white active:scale-[0.98]"
            >
              Agregar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QtyStepper({
  qty,
  setQty,
  limit,
  disabled,
}: {
  qty: number;
  setQty: (n: number) => void;
  limit: number;
  disabled: boolean;
}) {
  const btn =
    "grid size-10 place-items-center rounded-full text-lg transition-colors hover:bg-paper-2 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex h-13 items-center rounded-full border border-line px-1.5">
      <button type="button" className={btn} onClick={() => setQty(qty - 1)} disabled={disabled || qty <= 1} aria-label="Quitar uno">
        −
      </button>
      <span className="w-7 text-center tabular-nums" aria-live="polite" aria-label={`Cantidad ${qty}`}>
        {qty}
      </span>
      <button type="button" className={btn} onClick={() => setQty(qty + 1)} disabled={disabled || qty >= limit} aria-label="Agregar uno">
        +
      </button>
    </div>
  );
}
