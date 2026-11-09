"use client";

import { useActionState, useState } from "react";
import { btn, field, textarea } from "@/components/admin/ui";
import { saveProduct } from "./actions";

type Category = { id: string; name: string; parent_id: string | null };
type Option = { id: string; name: string; type: string; price_clp: number };
export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  type: string;
  category_id: string | null;
  description: string | null;
  origin: string | null;
  process: string | null;
  variety: string | null;
  tasting_notes: string | null;
  price_clp: number;
  track_stock: boolean;
  stock: number;
  low_stock_threshold: number;
  weight_g: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  visible_online: boolean;
  active: boolean;
  image_urls: string[];
};

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);

export function ProductForm({
  product,
  categories,
  options,
  bundle: initialBundle,
  cost,
  costs = {},
  ivaPct = 19,
}: {
  product: ProductRow | null;
  categories: Category[];
  options: Option[];
  bundle: { product_id: string; quantity: number }[];
  /** Costo unitario neto actual del producto */
  cost?: number | null;
  /** Costos netos de todos los productos (para calcular el de una promoción) */
  costs?: Record<string, number>;
  ivaPct?: number;
}) {
  const [state, action, pending] = useActionState(saveProduct, null);
  const [type, setType] = useState(product?.type ?? "cafe");
  const [trackStock, setTrackStock] = useState(product?.track_stock ?? true);
  const [bundle, setBundle] = useState(initialBundle.length ? initialBundle : [{ product_id: "", quantity: 1 }]);
  const [price, setPrice] = useState(String(product?.price_clp ?? ""));
  const [costInput, setCostInput] = useState(cost !== null && cost !== undefined ? String(cost) : "");

  // Margen: precio sin IVA menos costo neto
  const priceNum = Number(price.replace(/[.\s$]/g, ""));
  const bundleCost = bundle.every((b) => !b.product_id || costs[b.product_id] !== undefined)
    ? bundle.reduce((s, b) => s + (b.product_id ? (costs[b.product_id] ?? 0) * b.quantity : 0), 0)
    : null;
  const unitCost = type === "promocion" ? bundleCost : costInput.trim() ? Number(costInput.replace(/[.\s$]/g, "")) : null;
  const netPrice = priceNum > 0 ? priceNum / (1 + ivaPct / 100) : 0;
  const margin = unitCost !== null && Number.isFinite(unitCost) && netPrice > 0 ? (netPrice - unitCost) / netPrice : null;

  const parentName = (c: Category) => categories.find((x) => x.id === c.parent_id)?.name;
  const bundleRegular = bundle.reduce((s, b) => s + (options.find((o) => o.id === b.product_id)?.price_clp ?? 0) * b.quantity, 0);

  return (
    <form action={action} className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="space-y-6">
        <Section title="Básico">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Tipo">
              <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={field}>
                <option value="cafe">Café (bolsa 250 g, con molienda)</option>
                <option value="accesorio">Accesorio</option>
                <option value="promocion">Promoción (combina productos)</option>
                <option value="preparado">Preparado (solo feria)</option>
              </select>
            </F>
            <F label="Categoría">
              <select name="category_id" defaultValue={product?.category_id ?? ""} className={field}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {parentName(c) ? `${parentName(c)} › ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </F>
            <F label="Nombre" className="sm:col-span-2" hint={type === "cafe" ? 'Ej.: "La Betania, Colombia"' : undefined}>
              <input name="name" required defaultValue={product?.name} className={field} />
            </F>
            <F label="Precio (CLP, IVA incluido)">
              <input name="price_clp" required inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} className={field} />
            </F>
            {type === "promocion" ? (
              <div>
                <span className="mb-1 block text-sm font-medium">Costo neto</span>
                <p className="flex h-11 items-center rounded-xl bg-paper-2 px-3 text-sm tabular-nums">
                  {bundleCost !== null ? clp(bundleCost) : "Falta el costo de algún producto incluido"}
                </p>
                <span className="mt-1 block text-xs text-ink-mute">Suma de los costos de sus productos.</span>
              </div>
            ) : (
              <F label="Costo unitario neto (sin IVA)" hint="Lo que te cuesta cada unidad. Se usa para la utilidad real.">
                <input name="cost_clp" inputMode="numeric" value={costInput} onChange={(e) => setCostInput(e.target.value)} placeholder="Ej.: 6500" className={field} />
              </F>
            )}
            {margin !== null && (
              <p className={`text-sm sm:col-span-2 ${margin < 0.2 ? "text-accent-deep" : "text-ink-soft"}`}>
                Precio sin IVA {clp(Math.round(netPrice))} · margen bruto <b className="tabular-nums">{Math.round(margin * 100)} %</b>
                {margin < 0.2 && " (bajo: revisa el precio o el costo)"}
                <span className="text-ink-mute"> · antes de comisiones y gastos</span>
              </p>
            )}
            <F label="SKU (opcional)">
              <input name="sku" defaultValue={product?.sku ?? ""} className={field} />
            </F>
            <F label="Descripción" className="sm:col-span-2">
              <textarea name="description" rows={3} defaultValue={product?.description ?? ""} className={textarea} />
            </F>
          </div>
        </Section>

        {type === "cafe" && (
          <Section title="Ficha del café" hint="Se muestra en la tienda. Deja vacío lo que no sepas.">
            <div className="grid gap-4 sm:grid-cols-3">
              <F label="Origen"><input name="origin" defaultValue={product?.origin ?? ""} placeholder="Colombia" className={field} /></F>
              <F label="Proceso"><input name="process" defaultValue={product?.process ?? ""} placeholder="Lavado" className={field} /></F>
              <F label="Variedad"><input name="variety" defaultValue={product?.variety ?? ""} placeholder="Caturra" className={field} /></F>
              <F label="Notas de cata" className="sm:col-span-3" hint="Separadas por coma. Ej.: chocolate, mandarina, caña de azúcar">
                <input name="tasting_notes" defaultValue={product?.tasting_notes ?? ""} className={field} />
              </F>
            </div>
          </Section>
        )}

        {type === "promocion" && (
          <Section title="Qué incluye" hint="Al venderse descuenta stock de cada producto. Solo está disponible si todos tienen stock.">
            <input type="hidden" name="bundle" value={JSON.stringify(bundle)} />
            <div className="space-y-2">
              {bundle.map((b, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={b.product_id}
                    onChange={(e) => setBundle(bundle.map((x, j) => (j === i ? { ...x, product_id: e.target.value } : x)))}
                    className={field}
                  >
                    <option value="">Elige un producto</option>
                    {options.filter((o) => o.type !== "promocion" && o.id !== product?.id).map((o) => (
                      <option key={o.id} value={o.id}>{o.name} · {clp(o.price_clp)}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={b.quantity}
                    onChange={(e) => setBundle(bundle.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))}
                    className={`${field} w-20`}
                    aria-label="Cantidad"
                  />
                  <button type="button" onClick={() => setBundle(bundle.filter((_, j) => j !== i))} className={btn.secondary} aria-label="Quitar">×</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <button type="button" onClick={() => setBundle([...bundle, { product_id: "", quantity: 1 }])} className={btn.secondary}>+ Agregar producto</button>
              <span className="text-ink-soft">
                Por separado: {clp(bundleRegular)}
                {Number(price) > 0 && bundleRegular > Number(price) && <span className="font-medium text-leaf"> · ahorro {clp(bundleRegular - Number(price))}</span>}
              </span>
            </div>
          </Section>
        )}

        <Section title="Fotos" hint="JPG o PNG, idealmente cuadradas, de hasta 3,5 MB. La primera es la principal.">
          {product?.image_urls.length ? (
            <div className="mb-4 flex flex-wrap gap-3">
              {product.image_urls.map((url) => (
                <label key={url} className="relative block size-28 overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="size-full object-cover" />
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-white/90 px-2 py-1 text-xs">
                    <input type="checkbox" name="keep_image" value={url} defaultChecked /> Conservar
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-ink-mute">Sin fotos: la tienda muestra una ilustración.</p>
          )}
          <input type="file" name="images" accept="image/*" multiple className="text-sm" />
        </Section>
      </div>

      <div className="space-y-6">
        <Section title="Visibilidad">
          <div className="space-y-3 text-sm">
            <Check name="active" defaultChecked={product?.active ?? true} label="Activo" hint="Si lo desactivas, no se vende en ningún canal." />
            {type !== "preparado" && <Check name="visible_online" defaultChecked={product?.visible_online ?? true} label="Mostrar en la tienda online" hint="Desmarcado: solo se vende en ferias." />}
          </div>
          <F label="Dirección web" className="mt-4" hint="Se genera del nombre si la dejas vacía.">
            <input name="slug" defaultValue={product?.slug ?? ""} placeholder="se-genera-automaticamente" className={field} />
          </F>
        </Section>

        {type !== "promocion" && (
          <Section title="Stock">
            <Check name="track_stock" checked={trackStock} onChange={setTrackStock} label="Controlar stock" hint={type === "preparado" ? "Desmárcalo para bebidas que se preparan al momento." : undefined} />
            {trackStock && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                {product ? (
                  <div>
                    <p className="text-sm font-medium">Stock actual</p>
                    <p className="font-display text-2xl tabular-nums">{product.stock}</p>
                    <a href="/admin/stock" className="text-xs text-ink-soft underline">Ajustar en Stock</a>
                  </div>
                ) : (
                  <F label="Stock inicial"><input name="stock" inputMode="numeric" defaultValue="0" className={field} /></F>
                )}
                <F label="Avisar bajo" hint="Unidades"><input name="low_stock_threshold" inputMode="numeric" defaultValue={product?.low_stock_threshold ?? 3} className={field} /></F>
              </div>
            )}
          </Section>
        )}

        {type !== "preparado" && type !== "promocion" && (
          <Section title="Despacho" hint="Peso y medidas del paquete para cotizar envíos.">
            <div className="grid grid-cols-2 gap-4">
              <F label="Peso (g)"><input name="weight_g" inputMode="numeric" defaultValue={product?.weight_g ?? (type === "cafe" ? 300 : "")} className={field} /></F>
              <F label="Largo (cm)"><input name="length_cm" inputMode="decimal" defaultValue={product?.length_cm ?? ""} className={field} /></F>
              <F label="Ancho (cm)"><input name="width_cm" inputMode="decimal" defaultValue={product?.width_cm ?? ""} className={field} /></F>
              <F label="Alto (cm)"><input name="height_cm" inputMode="decimal" defaultValue={product?.height_cm ?? ""} className={field} /></F>
            </div>
          </Section>
        )}

        <div className="sticky bottom-4 rounded-2xl border border-line bg-paper p-4 shadow-lg">
          {state?.error && <p role="alert" className="mb-3 text-sm text-accent-deep">{state.error}</p>}
          {state?.ok && <p role="status" className="mb-3 text-sm text-leaf">{state.ok}</p>}
          <button disabled={pending} className={`${btn.primary} w-full`}>
            {pending ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white/60 p-5">
      <h2 className="font-display text-xl">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function F({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

function Check({ name, label, hint, defaultChecked, checked, onChange }: { name: string; label: string; hint?: string; defaultChecked?: boolean; checked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        name={name}
        className="mt-0.5 size-4 accent-accent"
        {...(checked !== undefined ? { checked, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.checked) } : { defaultChecked })}
      />
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
      </span>
    </label>
  );
}
