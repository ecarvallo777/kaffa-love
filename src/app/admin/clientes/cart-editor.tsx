"use client";

import { useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { btn, field } from "@/components/admin/ui";
import { saveCustomerCartAction } from "./actions";

type Product = { id: string; name: string; type: string; priceClp: number; stock: number | null };
type Row = { productId: string; qty: number; grind: string | null };

const GRINDS = [
  ["grano", "En grano"],
  ["fina", "Fina"],
  ["media", "Media"],
  ["gruesa", "Gruesa"],
] as const;
const TYPES: Record<string, string> = { cafe: "Café", accesorio: "Accesorios", promocion: "Promociones" };
const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

/** Carrito del cliente: productos, cantidad y molienda (café) */
export function CartEditor({ customerId, products, initial }: { customerId: string; products: Product[]; initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ productId: "", qty: 1, grind: null }]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const items = rows.filter((r) => r.productId);
  const total = items.reduce((s, r) => s + (byId.get(r.productId)?.priceClp ?? 0) * r.qty, 0);

  return (
    <ActionForm action={saveCustomerCartAction} className="space-y-3">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {rows.map((r, i) => {
        const p = byId.get(r.productId);
        return (
          <div key={i} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_130px_80px_100px_auto]">
            <select
              className={field}
              value={r.productId}
              aria-label="Producto"
              onChange={(e) => {
                const np = byId.get(e.target.value);
                set(i, { productId: e.target.value, grind: np?.type === "cafe" ? (r.grind ?? "grano") : null });
              }}
            >
              <option value="">Elige un producto…</option>
              {Object.entries(TYPES).map(([t, label]) => (
                <optgroup key={t} label={label}>
                  {products
                    .filter((x) => x.type === t)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} · {clp(x.priceClp)}
                        {x.stock !== null && x.stock <= 0 ? " (sin stock)" : ""}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {p?.type === "cafe" ? (
              <select className={field} value={r.grind ?? "grano"} onChange={(e) => set(i, { grind: e.target.value })} aria-label="Molienda">
                {GRINDS.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            ) : (
              <span className="hidden sm:block" />
            )}
            <input className={field} type="number" min={1} max={50} value={r.qty} onChange={(e) => set(i, { qty: Math.max(1, Number(e.target.value) || 1) })} aria-label="Cantidad" />
            <span className="text-right text-sm tabular-nums">{p ? clp(p.priceClp * r.qty) : "—"}</span>
            <button type="button" onClick={() => setRows((x) => x.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-full text-danger-deep hover:bg-danger/10" aria-label="Quitar">
              ✕
            </button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button type="button" onClick={() => setRows((x) => [...x, { productId: "", qty: 1, grind: null }])} className="text-sm text-accent underline-offset-4 hover:underline">
          ＋ Agregar producto
        </button>
        <p className="text-sm">
          Subtotal <b className="tabular-nums">{clp(total)}</b> <span className="text-ink-mute">(sin despacho)</span>
        </p>
      </div>
      <button className={btn.primary}>Guardar carrito</button>
    </ActionForm>
  );
}
