"use client";

import Link from "next/link";
import type { Catalog, Grind } from "@/lib/catalog-types";
import { availability, clp, productHref } from "@/lib/catalog-utils";
import { addToCart, cartCount, removeLine, setLineGrind, setLineQty, type CartLine } from "@/lib/cart-store";
import { GRINDS } from "@/lib/grinds";
import { ProductArt } from "@/components/product-art";
import { useSyncedCart } from "@/components/use-synced-cart";

export function CartView({ catalog, freeShippingFromClp }: { catalog: Catalog; freeShippingFromClp: number | null }) {
  const { lines, notices } = useSyncedCart(catalog);
  const subtotal = lines.reduce((s, l) => s + l.priceClp * l.qty, 0);
  const count = cartCount(lines);

  if (!lines.length) {
    return (
      <div className="mt-10 rounded-3xl bg-paper-2 px-6 py-16 text-center">
        {notices.length > 0 && <Notices notices={notices} />}
        <p className="font-display text-2xl">Tu carrito está vacío</p>
        <p className="mt-2 text-ink-soft">Empieza por un buen café.</p>
        <Link
          href="/categoria/cafe-de-especialidad"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper hover:bg-accent"
        >
          Ver cafés
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        {notices.length > 0 && <Notices notices={notices} />}
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => {
            const product = catalog.products.find((p) => p.id === line.productId);
            return (
              <li key={line.key} className="flex gap-4 py-5 sm:gap-6">
                <Link
                  href={productHref(line)}
                  className="size-24 shrink-0 overflow-hidden rounded-2xl bg-paper-2 sm:size-28"
                >
                  {product && <ProductArt product={product} catalog={catalog} />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <Link href={productHref(line)} className="font-display text-lg leading-snug hover:underline">
                      {line.name}
                    </Link>
                    <p className="shrink-0 font-medium tabular-nums">{clp(line.priceClp * line.qty)}</p>
                  </div>
                  <p className="text-sm text-ink-mute tabular-nums">{clp(line.priceClp)} c/u</p>

                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                    {line.grind && (
                      <label className="flex items-center gap-2 text-sm">
                        <span className="text-ink-mute">Molienda</span>
                        <select
                          value={line.grind}
                          onChange={(e) => setLineGrind(line.key, e.target.value as Grind)}
                          className="rounded-full border border-line bg-paper px-3 py-1.5"
                        >
                          {GRINDS.map((g) => (
                            <option key={g.value} value={g.value}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="flex items-center rounded-full border border-line">
                      <button
                        type="button"
                        onClick={() => setLineQty(line.key, line.qty - 1)}
                        className="grid size-9 place-items-center rounded-full hover:bg-paper-2"
                        aria-label={`Quitar uno de ${line.name}`}
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm tabular-nums">{line.qty}</span>
                      <button
                        type="button"
                        onClick={() => setLineQty(line.key, line.qty + 1)}
                        disabled={line.maxQty !== null && line.qty >= line.maxQty}
                        className="grid size-9 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30"
                        aria-label={`Agregar uno de ${line.name}`}
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className="text-sm text-ink-mute underline-offset-4 hover:text-accent hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <Link href="/" className="mt-6 inline-block text-sm text-ink-soft underline-offset-4 hover:underline">
          ← Seguir comprando
        </Link>
        <Suggestions catalog={catalog} lines={lines} gap={freeShippingFromClp ? Math.max(0, freeShippingFromClp - subtotal) : 0} />
      </div>

      <aside className="h-fit rounded-3xl bg-paper-2 p-6 lg:sticky lg:top-32">
        <h2 className="font-display text-2xl">Resumen</h2>
        {freeShippingFromClp && <FreeShippingBar threshold={freeShippingFromClp} subtotal={subtotal} />}
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              Productos ({count})
            </dt>
            <dd className="tabular-nums">{clp(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Envío</dt>
            <dd className="text-ink-soft">Se calcula en el siguiente paso</dd>
          </div>
        </dl>
        <div className="mt-5 flex items-baseline justify-between border-t border-line pt-5">
          <span className="font-medium">Subtotal</span>
          <span className="text-2xl font-medium tabular-nums">{clp(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-mute">IVA incluido</p>
        <Link
          href="/checkout"
          className="mt-6 flex h-13 items-center justify-center rounded-full bg-accent font-medium text-white shadow-[0_8px_20px_-8px_rgba(180,67,44,0.7)] transition-colors hover:bg-accent-deep"
        >
          Continuar con la compra
        </Link>
        <p className="mt-4 text-center text-xs text-ink-mute">
          Pago seguro con Mercado Pago · Retiro sin costo
        </p>
      </aside>
    </div>
  );
}

function Notices({ notices }: { notices: string[] }) {
  return (
    <div role="status" className="mb-6 rounded-2xl border border-crema/40 bg-crema/10 p-4 text-left text-sm">
      {notices.map((n) => (
        <p key={n}>{n}</p>
      ))}
    </div>
  );
}

function FreeShippingBar({ threshold, subtotal }: { threshold: number; subtotal: number }) {
  const missing = threshold - subtotal;
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div className="mt-4" data-testid="envio-gratis">
      <p className="text-sm">
        {missing > 0 ? (
          <>
            Te faltan <strong className="tabular-nums">{clp(missing)}</strong> para el <strong>despacho gratis</strong>.
          </>
        ) : (
          <strong className="text-leaf">¡Tu despacho a domicilio es gratis!</strong>
        )}
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Avance hacia el despacho gratis"
      >
        <div className={`h-full rounded-full transition-[width] ${missing > 0 ? "bg-accent" : "bg-leaf"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Hasta 3 productos disponibles que no están en el carrito; si falta poco para el despacho gratis, primero los que lo completan */
function Suggestions({ catalog, lines, gap }: { catalog: Catalog; lines: CartLine[]; gap: number }) {
  const inCart = new Set(lines.map((l) => l.productId));
  const candidates = catalog.products
    .filter((p) => p.type !== "preparado" && !inCart.has(p.id))
    .map((p) => ({ p, a: availability(p, catalog) }))
    .filter((x) => x.a.available);
  if (!candidates.length) return null;
  const covers = (x: (typeof candidates)[number]) => gap > 0 && x.p.price_clp >= gap;
  candidates.sort((x, y) => {
    if (covers(x) !== covers(y)) return covers(x) ? -1 : 1;
    // Entre los que completan el monto, el más cercano; si no, primero café y luego lo más económico
    if (covers(x)) return x.p.price_clp - y.p.price_clp;
    if ((x.p.type === "cafe") !== (y.p.type === "cafe")) return x.p.type === "cafe" ? -1 : 1;
    return x.p.price_clp - y.p.price_clp;
  });
  const picks = candidates.slice(0, 3);

  return (
    <section className="mt-12" aria-labelledby="sugerencias" data-testid="sugerencias">
      <h2 id="sugerencias" className="font-display text-2xl">
        {gap > 0 ? "Completa tu despacho gratis" : "También te puede gustar"}
      </h2>
      <ul className="mt-5 grid gap-4 sm:grid-cols-3">
        {picks.map(({ p, a }) => {
          const href = productHref(p);
          return (
            <li key={p.id} className="flex gap-3 rounded-2xl border border-line p-3 sm:flex-col">
              <Link href={href} className="size-20 shrink-0 overflow-hidden rounded-xl bg-paper-2 sm:aspect-square sm:size-auto">
                <ProductArt product={p} catalog={catalog} />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <Link href={href} className="font-display leading-snug hover:underline">
                  {p.name}
                </Link>
                <p className="text-sm text-ink-soft tabular-nums">{clp(p.price_clp)}</p>
                {p.type === "cafe" ? (
                  <Link href={href} className="mt-auto pt-2 text-sm font-medium text-accent underline-offset-4 hover:underline">
                    Elegir molienda →
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      addToCart({ productId: p.id, slug: p.slug, name: p.name, priceClp: p.price_clp, grind: null, maxQty: a.maxQty }, 1)
                    }
                    className="mt-auto self-start pt-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
                  >
                    + Agregar
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
