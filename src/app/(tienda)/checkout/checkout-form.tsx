"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Catalog } from "@/lib/catalog-types";
import { clp } from "@/lib/catalog-utils";
import { clearCart } from "@/lib/cart-store";
import { grindLabel } from "@/lib/grinds";
import { REGIONES } from "@/lib/chile";
import type { PickupLocation } from "@/lib/pickup";
import type { ShippingRate } from "@/lib/settings";
import type { CustomerProfile, SavedAddress } from "@/lib/customer-auth";
import { ProductArt } from "@/components/product-art";
import { useSyncedCart } from "@/components/use-synced-cart";
import { placeOrder } from "./actions";
import { track } from "@/lib/track";
import { parcelSize, rateFor, ratePrice, type CommuneRate } from "@/lib/shipping";

const DRAFT_KEY = "kaffa-checkout-v1";

type Draft = {
  email: string;
  name: string;
  phone: string;
  delivery: "retiro" | "despacho";
  pickupLocationId: string;
  region: string;
  commune: string;
  street: string;
  number: string;
  apartment: string;
  notes: string;
};

const EMPTY: Draft = {
  email: "",
  name: "",
  phone: "",
  delivery: "retiro",
  pickupLocationId: "",
  region: "",
  commune: "",
  street: "",
  number: "",
  apartment: "",
  notes: "",
};

function fromAddress(a: SavedAddress): Pick<Draft, "region" | "commune" | "street" | "number" | "apartment" | "notes"> {
  return {
    region: (REGIONES as readonly string[]).includes(a.region) ? a.region : "",
    commune: a.commune,
    street: a.street,
    number: a.number ?? "",
    apartment: a.apartment ?? "",
    notes: a.notes ?? "",
  };
}

export function CheckoutForm({
  catalog,
  pickups,
  rates,
  communeRates,
  freeShippingFromClp,
  profile,
}: {
  catalog: Catalog;
  pickups: PickupLocation[];
  rates: ShippingRate[];
  communeRates: CommuneRate[];
  freeShippingFromClp: number | null;
  profile: CustomerProfile | null;
}) {
  const { lines, notices } = useSyncedCart(catalog);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...EMPTY,
    pickupLocationId: pickups.length === 1 ? pickups[0].id : "",
    delivery: pickups.length ? "retiro" : "despacho",
    // Cliente con sesión: sus datos y su última dirección
    ...(profile
      ? { email: profile.email, name: profile.name, phone: profile.phone, ...(profile.addresses[0] ? fromAddress(profile.addresses[0]) : {}) }
      : {}),
  }));
  const [marketing, setMarketing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Recordar los datos de contacto en este navegador
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Partial<Draft> | null;
      if (!saved) return;
      const pickupLocationId = pickups.some((p) => p.id === saved.pickupLocationId) ? saved.pickupLocationId! : undefined;
      // Con sesión mandan los datos de la cuenta; del borrador solo se recuerda cómo recibir el pedido
      const restore = profile
        ? { ...(saved.delivery ? { delivery: saved.delivery } : {}), ...(pickupLocationId ? { pickupLocationId } : {}) }
        : { ...saved, ...(pickupLocationId ? { pickupLocationId } : {}) };
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga única desde localStorage
      setDraft((d) => ({ ...d, ...restore }));
    } catch {}
  }, [pickups, profile]);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const subtotal = lines.reduce((s, l) => s + l.priceClp * l.qty, 0);

  // Medición: inició el checkout (una vez por visita, con productos en el carrito)
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || !lines.length) return;
    tracked.current = true;
    track("inicio_checkout", { items: lines.reduce((s, l) => s + l.qty, 0), total: subtotal });
  }, [lines, subtotal]);
  const regionRate = rates.find((r) => r.region === draft.region);
  const rate = regionRate ? rateFor(regionRate, draft.commune, communeRates) : undefined;
  const freeShipping = freeShippingFromClp !== null && subtotal >= freeShippingFromClp;
  // Mismo cálculo que el servidor: XS para 1 bolsa de café, S para el resto
  const size = parcelSize(lines.map((l) => ({ type: catalog.products.find((p) => p.id === l.productId)?.type ?? "accesorio", qty: l.qty })));
  const ratePriceClp = rate ? ratePrice(rate, size) : null;
  const shipping = draft.delivery === "despacho" ? (ratePriceClp !== null ? (freeShipping ? 0 : ratePriceClp) : null) : 0;
  const total = subtotal + (shipping ?? 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    startTransition(async () => {
      const res = await placeOrder({
        email: draft.email,
        name: draft.name,
        phone: draft.phone,
        marketing,
        delivery: draft.delivery,
        pickupLocationId: draft.delivery === "retiro" ? draft.pickupLocationId : undefined,
        address:
          draft.delivery === "despacho"
            ? {
                street: draft.street,
                number: draft.number,
                apartment: draft.apartment,
                commune: draft.commune,
                region: draft.region,
                notes: draft.notes,
              }
            : undefined,
        lines: lines.map((l) => ({ productId: l.productId, grind: l.grind, qty: l.qty })),
      });
      if (res.ok) {
        setRedirecting(true);
        clearCart();
        window.location.assign(res.redirectTo);
      } else {
        setErrors(res.errors);
        requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    });
  }

  if (!lines.length && !redirecting) {
    return (
      <div className="mt-10 rounded-3xl bg-paper-2 px-6 py-16 text-center">
        {notices.map((n) => (
          <p key={n} className="mb-2 text-sm">{n}</p>
        ))}
        <p className="font-display text-2xl">Tu carrito está vacío</p>
        <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper hover:bg-accent">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  const busy = pending || redirecting;

  return (
    <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]" noValidate>
      <div className="space-y-10">
        {notices.length > 0 && (
          <div role="status" className="rounded-2xl border border-crema/40 bg-crema/10 p-4 text-sm">
            {notices.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        )}

        <Step n={1} title="Tus datos">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Correo"
              className="sm:col-span-2"
              hint={profile ? "Compras con tu cuenta. Aquí te llegará la confirmación del pedido." : "Te enviaremos aquí la confirmación del pedido."}
            >
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={draft.email}
                readOnly={!!profile}
                onChange={(e) => set("email", e.target.value)}
                className={`${input} ${profile ? "bg-paper-2 text-ink-soft" : ""}`}
              />
            </Field>
            <Field label="Nombre y apellido">
              <input required autoComplete="name" value={draft.name} onChange={(e) => set("name", e.target.value)} className={input} />
            </Field>
            <Field label="Teléfono">
              <input type="tel" required autoComplete="tel" inputMode="tel" placeholder="+56 9 1234 5678" value={draft.phone} onChange={(e) => set("phone", e.target.value)} className={input} />
            </Field>
          </div>
          <label className="mt-4 flex items-start gap-3 text-sm text-ink-soft">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 size-4 accent-accent" />
            Quiero recibir novedades: nuevos cafés, recetas y promociones. Puedes darte de baja cuando quieras.
          </label>
        </Step>

        <Step n={2} title="Entrega">
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Forma de entrega">
            {pickups.length > 0 && (
              <DeliveryOption
                checked={draft.delivery === "retiro"}
                onSelect={() => set("delivery", "retiro")}
                title="Retiro en persona"
                detail="Sin costo"
              />
            )}
            <DeliveryOption
              checked={draft.delivery === "despacho"}
              onSelect={() => set("delivery", "despacho")}
              title="Despacho a domicilio"
              detail={freeShipping ? "Gratis por tu compra" : "Según tu región"}
            />
          </div>

          {draft.delivery === "retiro" && (
            <div className="mt-5 space-y-3">
              {pickups.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${
                    draft.pickupLocationId === p.id ? "border-ink bg-paper-2" : "border-line hover:border-ink"
                  }`}
                >
                  <input type="radio" name="pickup" checked={draft.pickupLocationId === p.id} onChange={() => set("pickupLocationId", p.id)} className="mt-1 accent-accent" />
                  <span>
                    <span className="block font-medium">{p.name}</span>
                    <span className="block text-sm text-ink-soft">{p.address}</span>
                    <span className="block text-sm text-ink-mute">{p.hours}</span>
                  </span>
                </label>
              ))}
              <p className="text-sm text-ink-mute">Te avisaremos por correo cuando tu pedido esté listo para retirar.</p>
            </div>
          )}

          {draft.delivery === "despacho" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              {profile && profile.addresses.length > 0 && (
                <Field label="Tus direcciones" className="sm:col-span-6">
                  <select
                    value=""
                    onChange={(e) => {
                      const a = profile.addresses.find((x) => x.id === e.target.value);
                      if (a) setDraft((d) => ({ ...d, ...fromAddress(a) }));
                    }}
                    className={input}
                  >
                    <option value="">Usar una dirección guardada…</option>
                    {profile.addresses.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.street} {a.number}
                        {a.apartment ? `, ${a.apartment}` : ""} · {a.commune}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Región" className="sm:col-span-3">
                <select required autoComplete="address-level1" value={draft.region} onChange={(e) => set("region", e.target.value)} className={input}>
                  <option value="">Elige tu región</option>
                  {REGIONES.map((r) => (
                    <option key={r} value={r} disabled={!rates.some((x) => x.region === r)}>
                      {r}
                      {!rates.some((x) => x.region === r) ? " (sin despacho por ahora)" : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Comuna" className="sm:col-span-3">
                <input required autoComplete="address-level2" value={draft.commune} onChange={(e) => set("commune", e.target.value)} className={input} />
              </Field>
              <Field label="Calle" className="sm:col-span-4">
                <input required autoComplete="address-line1" value={draft.street} onChange={(e) => set("street", e.target.value)} className={input} />
              </Field>
              <Field label="Número" className="sm:col-span-2">
                <input required inputMode="numeric" value={draft.number} onChange={(e) => set("number", e.target.value)} className={input} />
              </Field>
              <Field label="Depto, casa u oficina (opcional)" className="sm:col-span-3">
                <input autoComplete="address-line2" value={draft.apartment} onChange={(e) => set("apartment", e.target.value)} className={input} />
              </Field>
              <Field label="Indicaciones (opcional)" className="sm:col-span-3">
                <input value={draft.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Ej.: dejar en conserjería" className={input} />
              </Field>
              {rate && (
                <p className="rounded-2xl bg-paper-2 p-4 text-sm sm:col-span-6">
                  <span className="font-medium">Despacho con Blue Express</span> · {rate.days} ·{" "}
                  <span className="font-medium tabular-nums">{freeShipping ? "Gratis" : clp(ratePriceClp ?? rate.priceClp)}</span>
                </p>
              )}
            </div>
          )}
        </Step>
      </div>

      <aside className="h-fit rounded-3xl bg-paper-2 p-6 lg:sticky lg:top-32">
        <h2 className="font-display text-2xl">Tu pedido</h2>
        <ul className="mt-5 space-y-4">
          {lines.map((l) => {
            const p = catalog.products.find((x) => x.id === l.productId);
            return (
              <li key={l.key} className="flex gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-paper">
                  {p && <ProductArt product={p} catalog={catalog} />}
                  <span className="absolute -top-0 -right-0 grid size-5 place-items-center rounded-bl-lg bg-ink text-[0.65rem] text-paper">{l.qty}</span>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium leading-snug">{l.name}</p>
                  {l.grind && <p className="text-ink-mute">Molienda {grindLabel(l.grind)?.toLowerCase()}</p>}
                </div>
                <p className="text-sm tabular-nums">{clp(l.priceClp * l.qty)}</p>
              </li>
            );
          })}
        </ul>
        <dl className="mt-6 space-y-2 border-t border-line pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Productos</dt>
            <dd className="tabular-nums">{clp(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">{draft.delivery === "retiro" ? "Retiro" : "Despacho"}</dt>
            <dd className="tabular-nums">
              {shipping === null ? <span className="text-ink-mute">Elige tu región</span> : shipping === 0 ? "Gratis" : clp(shipping)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-medium">Total</span>
          <span className="text-2xl font-medium tabular-nums">{clp(total)}</span>
        </div>
        <p className="text-xs text-ink-mute">IVA incluido</p>

        {errors.length > 0 && (
          <div ref={errorRef} role="alert" className="mt-5 rounded-2xl border border-accent/40 bg-accent/5 p-4 text-sm text-accent-deep">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || shipping === null}
          className="mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-accent font-medium text-white shadow-[0_8px_20px_-8px_rgba(180,67,44,0.7)] transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {redirecting ? "Te llevamos a Mercado Pago…" : "Reservando tu pedido…"}
            </>
          ) : (
            <>Pagar {clp(total)} con Mercado Pago</>
          )}
        </button>
        <p className="mt-4 text-center text-xs leading-relaxed text-ink-mute">
          Reservamos tus productos por 30 minutos mientras pagas. Al pagar aceptas los{" "}
          <Link href="/legal/terminos" className="underline">términos</Link> y la{" "}
          <Link href="/legal/cambios-y-devoluciones" className="underline">política de cambios</Link>.
        </p>
      </aside>
    </form>
  );
}

const input =
  "h-12 w-full rounded-xl border border-line bg-paper px-4 text-base outline-none transition-colors placeholder:text-ink-mute/70 focus:border-ink";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 flex items-center gap-3 font-display text-2xl">
        <span className="grid size-8 place-items-center rounded-full bg-ink font-sans text-sm text-paper">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

function DeliveryOption({ checked, onSelect, title, detail }: { checked: boolean; onSelect: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-colors ${
        checked ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
      }`}
    >
      <span className={`grid size-5 shrink-0 place-items-center rounded-full border-2 ${checked ? "border-paper" : "border-line"}`}>
        {checked && <span className="size-2 rounded-full bg-paper" />}
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className={`block text-sm ${checked ? "text-paper/70" : "text-ink-mute"}`}>{detail}</span>
      </span>
    </button>
  );
}
