"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { BundleItem, Catalog, Grind, Product } from "@/lib/catalog-types";
import { availability, clp } from "@/lib/catalog-utils";
import { GRINDS } from "@/lib/grinds";
import { GrindGlyph } from "@/components/grind-glyph";
import { sellAction, voidSaleAction } from "./actions";

type Line = { key: string; product: Product; grind: Grind | null; qty: number };
type Recent = { id: string; number: number; total: number; status: string; at: string };

const TABS = [
  ["cafe", "Café"],
  ["preparado", "Preparados"],
  ["accesorio", "Accesorios"],
  ["promocion", "Promociones"],
] as const;

export function Pos({
  session,
  products,
  bundleItems,
  categories,
  totals,
  recent,
}: {
  session: { id: string; name: string };
  products: Product[];
  bundleItems: BundleItem[];
  categories: Catalog["categories"];
  totals: { count: number; total: number };
  recent: Recent[];
}) {
  const catalog: Catalog = useMemo(() => ({ products, bundleItems, categories }), [products, bundleItems, categories]);
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("cafe");
  const [lines, setLines] = useState<Line[]>([]);
  const [grindFor, setGrindFor] = useState<Product | null>(null);
  const [charging, setCharging] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const total = lines.reduce((s, l) => s + l.product.price_clp * l.qty, 0);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const shown = products.filter((p) => p.type === tab);

  // Unidades ya en el carrito (las promociones consumen sus componentes)
  function inCart(productId: string) {
    let n = 0;
    for (const l of lines) {
      if (l.product.id === productId) n += l.qty;
      if (l.product.type === "promocion") {
        const b = bundleItems.find((x) => x.bundle_id === l.product.id && x.product_id === productId);
        if (b) n += b.quantity * l.qty;
      }
    }
    return n;
  }

  function remaining(p: Product) {
    const { maxQty } = availability(p, catalog);
    if (p.type === "promocion") {
      const comps = bundleItems.filter((b) => b.bundle_id === p.id);
      const caps = comps.map((b) => {
        const c = products.find((x) => x.id === b.product_id);
        if (!c?.track_stock) return Infinity;
        return Math.floor((c.stock - inCart(c.id)) / b.quantity);
      });
      return caps.length ? Math.min(...caps) : 0;
    }
    return maxQty === null ? Infinity : maxQty - inCart(p.id);
  }

  function add(p: Product, grind: Grind | null) {
    if (remaining(p) <= 0) return;
    setMessage(null);
    const key = `${p.id}:${grind ?? "-"}`;
    setLines((ls) => (ls.some((l) => l.key === key) ? ls.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { key, product: p, grind, qty: 1 }]));
  }

  function changeQty(key: string, delta: number) {
    setLines((ls) =>
      ls
        .map((l) => (l.key === key ? (delta > 0 && remaining(l.product) <= 0 ? l : { ...l, qty: l.qty + delta }) : l))
        .filter((l) => l.qty > 0),
    );
  }

  function confirmSale() {
    start(async () => {
      const res = await sellAction(
        session.id,
        lines.map((l) => ({ productId: l.product.id, grind: l.grind, qty: l.qty })),
      );
      setCharging(false);
      if (res.ok) {
        setLines([]);
        setMessage({ tone: "ok", text: `Venta #${res.number} registrada · ${clp(res.total)}` });
      } else {
        setMessage({ tone: "bad", text: res.error });
      }
    });
  }

  return (
    <div className="flex min-h-[calc(100vh-44px)] flex-col lg:flex-row">
      {/* Productos */}
      <section className="flex-1 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs tracking-wide text-ink-mute uppercase">Jornada</p>
            <p className="font-display text-xl leading-tight">{session.name}</p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-xs text-ink-mute">{totals.count} ventas hoy</p>
              <p className="font-display text-2xl tabular-nums">{clp(totals.total)}</p>
            </div>
            <Link href="/feria/cierre" className="rounded-full border border-line px-4 py-2 text-sm">Cerrar jornada</Link>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-4 gap-1.5 rounded-2xl bg-paper-2 p-1.5">
          {TABS.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} className={`h-12 rounded-xl text-sm font-medium sm:text-base ${tab === k ? "bg-ink text-paper" : "text-ink-soft"}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {shown.map((p) => {
            const left = remaining(p);
            const out = left <= 0;
            return (
              <button
                key={p.id}
                disabled={out}
                onClick={() => (p.type === "cafe" ? setGrindFor(p) : add(p, null))}
                className="flex min-h-28 flex-col justify-between rounded-2xl border border-line bg-white p-3 text-left transition-transform active:scale-[0.97] disabled:opacity-40"
              >
                <span className="font-medium leading-snug">{p.name}</span>
                <span className="mt-2 flex items-end justify-between gap-2">
                  <span className="font-display text-xl tabular-nums">{clp(p.price_clp)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${out ? "bg-accent/15 text-accent-deep" : left <= 3 ? "bg-crema/25 text-[#8a5a1c]" : "bg-paper-2 text-ink-soft"}`}>
                    {out ? "Agotado" : left === Infinity ? "∞" : `${left} disp.`}
                  </span>
                </span>
              </button>
            );
          })}
          {!shown.length && <p className="col-span-full p-6 text-center text-ink-mute">No hay productos en esta categoría.</p>}
        </div>

        {recent.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-ink-soft">Últimas ventas</p>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-white/60 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="tabular-nums">#{r.number}</span>
                  <span className="text-ink-mute">{new Date(r.at).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className={`flex-1 text-right tabular-nums ${r.status === "cancelado" ? "line-through text-ink-mute" : ""}`}>{clp(r.total)}</span>
                  {r.status !== "cancelado" && (
                    <button
                      onClick={() => {
                        if (!confirm(`¿Anular la venta #${r.number}? El stock vuelve al inventario. Recuerda anular también el cobro en Point.`)) return;
                        start(async () => {
                          const err = await voidSaleAction(r.id);
                          setMessage(err ? { tone: "bad", text: err } : { tone: "ok", text: `Venta #${r.number} anulada.` });
                        });
                      }}
                      className="text-xs text-accent-deep underline"
                    >
                      Anular
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Carrito */}
      <aside className="sticky bottom-0 border-t border-line bg-paper-2 p-3 sm:p-4 lg:top-0 lg:h-[calc(100vh-44px)] lg:w-[380px] lg:border-t-0 lg:border-l">
        <div className="flex h-full flex-col">
          {message && (
            <p role="status" className={`mb-3 rounded-xl px-3 py-2.5 text-sm font-medium ${message.tone === "ok" ? "bg-leaf text-paper" : "bg-accent text-white"}`}>
              {message.text}
            </p>
          )}
          <ul className="max-h-48 flex-1 space-y-2 overflow-y-auto lg:max-h-none">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center gap-2 rounded-xl bg-white p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.product.name}</p>
                  <p className="text-xs text-ink-mute">
                    {l.grind ? `${GRINDS.find((g) => g.value === l.grind)?.label} · ` : ""}
                    {clp(l.product.price_clp * l.qty)}
                  </p>
                </div>
                <button onClick={() => changeQty(l.key, -1)} className="grid size-10 place-items-center rounded-full bg-paper-2 text-lg" aria-label="Quitar uno">−</button>
                <span className="w-6 text-center tabular-nums">{l.qty}</span>
                <button onClick={() => changeQty(l.key, 1)} className="grid size-10 place-items-center rounded-full bg-paper-2 text-lg" aria-label="Agregar uno">+</button>
              </li>
            ))}
            {!lines.length && <li className="py-6 text-center text-sm text-ink-mute">Toca un producto para agregarlo</li>}
          </ul>
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-ink-soft">{count} {count === 1 ? "producto" : "productos"}</span>
              <span className="font-display text-4xl tabular-nums">{clp(total)}</span>
            </div>
            <div className="mt-3 grid grid-cols-[auto_1fr] gap-2">
              <button onClick={() => setLines([])} disabled={!lines.length} className="h-14 rounded-full border border-line px-5 disabled:opacity-40">Vaciar</button>
              <button onClick={() => setCharging(true)} disabled={!lines.length || pending} className="h-14 rounded-full bg-accent text-lg font-medium text-white disabled:opacity-40">
                Cobrar
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Elegir molienda */}
      {grindFor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center" onClick={() => setGrindFor(null)}>
          <div className="w-full max-w-lg rounded-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-ink-mute">Molienda para</p>
            <p className="font-display text-2xl">{grindFor.name}</p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {GRINDS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => {
                    add(grindFor, g.value);
                    setGrindFor(null);
                  }}
                  className="flex h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white active:scale-[0.97]"
                >
                  <GrindGlyph grind={g.value} className="size-8 text-ink-soft" />
                  <span className="font-medium">{g.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setGrindFor(null)} className="mt-3 h-12 w-full rounded-full text-ink-soft">Cancelar</button>
          </div>
        </div>
      )}

      {/* Cobro con Point */}
      {charging && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
          <div className="w-full max-w-md rounded-3xl bg-paper p-6 text-center">
            <p className="text-sm tracking-wide text-ink-mute uppercase">Ingresa en Mercado Pago Point</p>
            <p className="mt-2 font-display text-6xl tabular-nums">{clp(total)}</p>
            <p className="mt-3 text-sm text-ink-soft">Cuando el Point muestre el pago aprobado, confirma aquí. Si fue rechazado, cancela.</p>
            <div className="mt-6 grid gap-2.5">
              <button onClick={confirmSale} disabled={pending} className="h-16 rounded-full bg-leaf text-lg font-medium text-paper disabled:opacity-60">
                {pending ? "Registrando…" : "Cobro aprobado"}
              </button>
              <button onClick={() => setCharging(false)} disabled={pending} className="h-14 rounded-full border border-line">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
