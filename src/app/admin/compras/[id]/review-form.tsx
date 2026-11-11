"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { btn, field } from "@/components/admin/ui";
import type { Purchase } from "@/lib/purchases";
import { confirmPurchase } from "../actions";

type Product = { id: string; name: string; type: string; stock: number; active: boolean; cost: number | null };
type Category = { id: string; name: string };
type Row = {
  action: "existente" | "nuevo" | "ignorar";
  productId: string;
  units: string;
  unitCost: string | null; // null = calculado
  name: string;
  type: "cafe" | "accesorio";
  price: string;
  categoryId: string;
};

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const num = (v: string) => Number(v.replace(/[.\s$]/g, "").replace(",", "."));

const CONFIDENCE = { alta: "", media: "Revisa: relación probable", baja: "Revisa: relación dudosa" } as const;

export function ReviewForm({ purchase: p, products, categories }: { purchase: Purchase; products: Product[]; categories: Category[] }) {
  const byId = useMemo(() => new Map(products.map((x) => [x.id, x])), [products]);
  const [spread, setSpread] = useState(p.otherChargesNetClp !== 0);
  const [rows, setRows] = useState<Row[]>(() =>
    p.lines.map((l) => ({
      action: l.productId ? "existente" : l.lineNetClp > 0 ? "nuevo" : "ignorar",
      productId: l.productId ?? "",
      units: String(Math.max(1, Math.round(l.quantity * l.unitsPerQuantity))),
      unitCost: null,
      name: l.newProduct?.name ?? l.description,
      type: l.newProduct?.type ?? "accesorio",
      price: "",
      categoryId: "",
    })),
  );
  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  // Otros cargos (despacho, descuentos globales) se reparten según el monto de cada línea
  const base = p.lines.reduce((s, l, i) => s + (rows[i].action === "ignorar" || l.applied ? 0 : l.lineNetClp), 0);
  const calcCost = (i: number) => {
    const l = p.lines[i];
    const units = num(rows[i].units);
    if (!units || units <= 0) return 0;
    const share = spread && base > 0 ? (p.otherChargesNetClp * l.lineNetClp) / base : 0;
    return Math.round((l.lineNetClp + share) / units);
  };
  const unitCost = (i: number) => (rows[i].unitCost !== null ? num(rows[i].unitCost!) : calcCost(i));

  const payload = rows.map((r, index) => {
    if (p.lines[index].applied || r.action === "ignorar") return { index, action: "ignorar" as const };
    const units = num(r.units);
    if (r.action === "existente") return { index, action: r.action, productId: r.productId, units, unitCostClp: unitCost(index) };
    return {
      index,
      action: r.action,
      units,
      unitCostClp: unitCost(index),
      name: r.name,
      type: r.type,
      priceClp: num(r.price),
      categoryId: r.categoryId || null,
    };
  });
  const totalUnits = payload.reduce((s, l) => s + ("units" in l ? l.units || 0 : 0), 0);

  return (
    <ActionForm action={confirmPurchase} className="space-y-4">
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="lines" value={JSON.stringify(payload.filter((_, i) => !p.lines[i].applied))} />

      {p.otherChargesNetClp !== 0 && (
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-white/60 p-4 text-sm">
          <input type="checkbox" checked={spread} onChange={(e) => setSpread(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
          <span>
            Repartir {p.otherChargesNetClp > 0 ? "los otros cargos" : "el descuento"} de <b>{clp(p.otherChargesNetClp)}</b> (despacho, fletes o descuentos
            globales) en el costo de cada producto, según su monto.
          </span>
        </label>
      )}

      {p.lines.map((l, i) => {
        const r = rows[i];
        const prod = r.action === "existente" ? byId.get(r.productId) : undefined;
        const uc = unitCost(i);
        const units = num(r.units) || 0;
        const avg =
          prod && prod.cost !== null && prod.stock > 0 && units > 0 ? Math.round((prod.cost * prod.stock + uc * units) / (prod.stock + units)) : uc;
        const done = Boolean(l.applied);
        return (
          <section key={i} className={`rounded-2xl border border-line bg-white/60 p-4 ${done || r.action === "ignorar" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                {l.description}
                {l.sku && <span className="ml-2 text-xs text-ink-mute">{l.sku}</span>}
              </p>
              <p className="text-sm text-ink-soft tabular-nums">
                {l.quantity} × {l.unitsPerQuantity > 1 ? `${l.unitsPerQuantity} u. · ` : ""}neto {clp(l.lineNetClp)}
              </p>
            </div>
            {done ? (
              <p className="mt-2 text-sm text-leaf">Ya aplicada.</p>
            ) : (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1.4fr_0.6fr_0.8fr]">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Producto</span>
                    <select
                      className={field}
                      value={r.action === "existente" ? r.productId : r.action}
                      onChange={(e) => {
                        const v = e.target.value;
                        set(i, v === "nuevo" || v === "ignorar" ? { action: v } : { action: "existente", productId: v });
                      }}
                    >
                      <option value="ignorar">No cargar (ignorar línea)</option>
                      <option value="nuevo">＋ Crear producto nuevo</option>
                      <optgroup label="Productos de la tienda">
                        {products.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                            {x.active ? "" : " (inactivo)"}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    {r.action === "existente" && CONFIDENCE[l.confidence] && l.productId === r.productId && (
                      <span className="mt-1 block text-xs text-[#8a5a1c]">{CONFIDENCE[l.confidence]}</span>
                    )}
                  </label>
                  {r.action !== "ignorar" && (
                    <>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Unidades que entran</span>
                        <input className={field} inputMode="numeric" value={r.units} onChange={(e) => set(i, { units: e.target.value })} />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium">Costo neto unitario</span>
                        <input
                          className={field}
                          inputMode="numeric"
                          value={r.unitCost ?? String(calcCost(i))}
                          onChange={(e) => set(i, { unitCost: e.target.value })}
                        />
                      </label>
                    </>
                  )}
                </div>

                {r.action === "nuevo" && (
                  <div className="mt-3 grid gap-3 rounded-xl bg-paper-2/60 p-3 sm:grid-cols-[1.4fr_0.7fr_0.7fr_1fr]">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Nombre en la tienda</span>
                      <input className={field} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Tipo</span>
                      <select className={field} value={r.type} onChange={(e) => set(i, { type: e.target.value as Row["type"] })}>
                        <option value="accesorio">Accesorio</option>
                        <option value="cafe">Café</option>
                      </select>
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Precio de venta</span>
                      <input className={field} inputMode="numeric" placeholder="IVA incluido" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium">Categoría</span>
                      <select className={field} value={r.categoryId} onChange={(e) => set(i, { categoryId: e.target.value })}>
                        <option value="">Sin categoría</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs text-ink-mute sm:col-span-4">
                      Se crea oculto en la tienda: agrégale foto y descripción, y publícalo desde Productos.
                      {num(r.price) > 0 && uc > 0 && <> Margen bruto estimado: {Math.round((1 - uc / (num(r.price) / 1.19)) * 100)} %.</>}
                    </p>
                  </div>
                )}

                {prod && (
                  <p className="mt-2 text-xs text-ink-mute">
                    Hoy: {prod.stock} en stock, costo {prod.cost !== null ? clp(prod.cost) : "sin registrar"} → quedará en {prod.stock + units} y costo promedio{" "}
                    <b>{clp(avg)}</b>.
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button className={btn.primary}>Confirmar compra</button>
        <span className="text-sm text-ink-soft">Entran {totalUnits} unidades al inventario.</span>
      </div>
    </ActionForm>
  );
}
