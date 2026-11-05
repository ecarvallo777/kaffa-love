import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import type { Catalog, Product } from "@/lib/catalog-types";
import {
  availability,
  bundleDetails,
  categoryById,
  categoryHref,
  clp,
  displayName,
  productHref,
  tastingNotes,
} from "@/lib/catalog-utils";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { TastingNotes } from "@/components/tasting-notes";
import { AddToCart } from "@/components/add-to-cart";
import { GrindGuide } from "@/components/grind-guide";

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const catalog = await getCatalog();
  const p = catalog.products.find((x) => x.slug === slug);
  if (!p) return {};
  const notes = tastingNotes(p);
  return {
    title: p.name,
    description:
      p.description ??
      (notes.length ? `Notas de ${notes.join(", ")}. ${clp(p.price_clp)}.` : `${p.name} · ${clp(p.price_clp)}`),
  };
}

export default function ProductPage(props: PageProps<"/producto/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductView params={props.params} />
    </Suspense>
  );
}

async function ProductView({ params }: Pick<PageProps<"/producto/[slug]">, "params">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const product = catalog.products.find((p) => p.slug === slug);
  if (!product || product.type === "preparado") notFound();

  const { available, maxQty, low } = availability(product, catalog);
  const { title, subtitle } = displayName(product);
  const notes = tastingNotes(product);
  const category = categoryById(catalog, product.category_id);
  const parent = category?.parent_id ? categoryById(catalog, category.parent_id) : null;
  const bundle = product.type === "promocion" ? bundleDetails(product, catalog) : null;
  const isCoffee = product.type === "cafe";

  const eyebrow = isCoffee
    ? [product.origin ?? subtitle, "250 g"].filter(Boolean).join(" · ")
    : bundle
      ? `Promoción · ${bundle.items.length} productos`
      : (category?.name ?? "");

  // Datos estructurados para buscadores (Google Shopping / resultados enriquecidos)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? (notes.length ? `Notas de ${notes.join(", ")}` : product.name),
    ...(product.image_urls[0] ? { image: product.image_urls } : {}),
    brand: { "@type": "Brand", name: "Kaffa Love" },
    ...(product.origin ? { countryOfOrigin: product.origin } : {}),
    offers: {
      "@type": "Offer",
      price: product.price_clp,
      priceCurrency: "CLP",
      availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: `/producto/${product.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav aria-label="Ruta" className="pt-6 text-sm text-ink-mute sm:pt-8">
        <Link href="/" className="hover:text-ink">
          Inicio
        </Link>
        {(parent ?? category) && (
          <>
            <span className="mx-2">/</span>
            <Link href={categoryHref((parent ?? category)!)} className="hover:text-ink">
              {(parent ?? category)!.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-20">
        {/* Imagen */}
        <div className="md:sticky md:top-32 md:self-start">
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-paper-2">
            <ProductArt
              product={product}
              catalog={catalog}
              className={available ? "" : "opacity-50 grayscale"}
            />
            {bundle && bundle.savings > 0 && (
              <span className="absolute top-5 left-5 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-white">
                Ahorras {clp(bundle.savings)}
              </span>
            )}
          </div>
        </div>

        {/* Compra */}
        <div className="pb-6">
          <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-light tracking-tight text-balance sm:text-5xl">
            {title}
          </h1>
          {notes.length > 0 && (
            <p className="mt-3 font-display text-xl text-ink-soft italic">{notes.join(", ")}</p>
          )}

          <div className="mt-6 flex items-baseline gap-3">
            <p className="text-2xl font-medium tabular-nums">{clp(product.price_clp)}</p>
            {bundle && bundle.savings > 0 && (
              <p className="text-ink-mute tabular-nums line-through">{clp(bundle.regular)}</p>
            )}
            <p className="text-sm text-ink-mute">IVA incluido</p>
          </div>
          <StockLine available={available} low={low} maxQty={maxQty} />

          {product.description && (
            <p className="mt-6 max-w-prose leading-relaxed text-ink-soft">{product.description}</p>
          )}

          <div className="mt-8">
            <AddToCart
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                priceClp: product.price_clp,
                isCoffee,
              }}
              available={available}
              maxQty={maxQty}
            />
          </div>

          <ul className="mt-8 divide-y divide-line border-y border-line text-sm">
            <Perk icon="truck" title="Despacho a domicilio" text="Cotizado con Blue Express al finalizar la compra." />
            <Perk icon="store" title="Retiro sin costo" text="Elige retiro en persona en el checkout." />
            <Perk icon="lock" title="Pago seguro" text="Con Mercado Pago. La boleta llega desde Mercado Pago." />
          </ul>

          {isCoffee && <CoffeeDetails product={product} notes={notes} />}
          {bundle && <BundleContents bundle={bundle} catalog={catalog} />}
          {product.type === "accesorio" && <InPromos product={product} catalog={catalog} />}
        </div>
      </div>

      {isCoffee && (
        <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Recipe />
          <GrindGuide compact />
        </div>
      )}

      <Related product={product} catalog={catalog} />
    </div>
  );
}

function StockLine({ available, low, maxQty }: { available: boolean; low: boolean; maxQty: number | null }) {
  const [dot, text] = !available
    ? ["bg-ink-mute", "Agotado por ahora"]
    : low && maxQty !== null
      ? ["bg-crema", maxQty === 1 ? "¡Última unidad!" : `Quedan solo ${maxQty} unidades`]
      : ["bg-leaf", "Disponible"];
  return (
    <p className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
      {text}
    </p>
  );
}

function Perk({ icon, title, text }: { icon: "truck" | "store" | "lock"; title: string; text: string }) {
  const paths = {
    truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
    store: "M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M10 20v-6h4v6",
    lock: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  };
  return (
    <li className="flex gap-3 py-3.5">
      <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
        <path d={paths[icon]} />
      </svg>
      <span>
        <span className="font-medium">{title}</span>
        <span className="text-ink-soft"> · {text}</span>
      </span>
    </li>
  );
}

function CoffeeDetails({ product, notes }: { product: Product; notes: string[] }) {
  const specs = [
    ["Origen", product.origin],
    ["Proceso", product.process],
    ["Variedad", product.variety],
    ["Formato", "Bolsa de 250 g"],
  ].filter((s): s is [string, string] => !!s[1]);

  return (
    <div className="mt-10 space-y-8">
      {notes.length > 0 && (
        <div>
          <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">Notas de cata</h2>
          <div className="mt-3">
            <TastingNotes notes={notes} size="lg" />
          </div>
        </div>
      )}
      <div>
        <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">Ficha</h2>
        <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
          {specs.map(([k, v]) => (
            <div key={k} className="bg-paper p-4">
              <dt className="text-xs text-ink-mute">{k}</dt>
              <dd className="mt-1 font-display text-lg">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function BundleContents({
  bundle,
  catalog,
}: {
  bundle: ReturnType<typeof bundleDetails>;
  catalog: Catalog;
}) {
  return (
    <div className="mt-10">
      <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">Qué incluye</h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
        {bundle.items.map(({ product: p, quantity }) => (
          <li key={p.id}>
            <Link href={productHref(p)} className="flex items-center gap-4 p-3 transition-colors hover:bg-paper-2">
              <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-paper-2">
                <ProductArt product={p} catalog={catalog} />
              </div>
              <span className="flex-1">
                {quantity > 1 && <span className="text-ink-mute">{quantity} × </span>}
                {p.name}
              </span>
              <span className="text-sm text-ink-mute tabular-nums">{clp(p.price_clp * quantity)}</span>
            </Link>
          </li>
        ))}
        <li className="flex justify-between p-4 text-sm">
          <span className="text-ink-soft">Por separado</span>
          <span className="tabular-nums line-through">{clp(bundle.regular)}</span>
        </li>
        {bundle.savings > 0 && (
          <li className="flex justify-between p-4 font-medium text-accent">
            <span>Tu ahorro</span>
            <span className="tabular-nums">{clp(bundle.savings)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function InPromos({ product, catalog }: { product: Product; catalog: Catalog }) {
  const promos = catalog.products.filter(
    (p) =>
      p.type === "promocion" &&
      catalog.bundleItems.some((b) => b.bundle_id === p.id && b.product_id === product.id) &&
      availability(p, catalog).available,
  );
  if (!promos.length) return null;
  return (
    <div className="mt-10">
      <h2 className="text-xs tracking-[0.16em] text-ink-mute uppercase">Ahorra llevándolo en promoción</h2>
      <ul className="mt-3 space-y-2">
        {promos.map((p) => {
          const { savings } = bundleDetails(p, catalog);
          return (
            <li key={p.id}>
              <Link
                href={productHref(p)}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-line p-4 transition-colors hover:border-ink"
              >
                <span>
                  <span className="block font-display text-lg">{p.name}</span>
                  <span className="text-sm text-ink-soft">
                    {clp(p.price_clp)}
                    {savings > 0 && <span className="text-accent"> · ahorras {clp(savings)}</span>}
                  </span>
                </span>
                <span className="transition-transform group-hover:translate-x-1" aria-hidden>→</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Recipe() {
  const steps = [
    ["Muele", "15 g de café en molienda media."],
    ["Calienta", "250 ml de agua a 92–94 °C, recién hervida y reposada 30 segundos."],
    ["Pre-infusión", "Vierte 30 ml, espera 30 segundos a que el café “florezca”."],
    ["Vierte", "El resto del agua en círculos lentos. Total: 2:30 a 3:00 minutos."],
  ];
  return (
    <section className="rounded-3xl border border-line p-6 sm:p-8">
      <p className="text-xs tracking-[0.18em] text-accent uppercase">Receta sugerida</p>
      <h2 className="mt-2 font-display text-2xl">Filtrado en V60 o Chemex</h2>
      <div className="mt-6 flex gap-6 text-center">
        {[
          ["15 g", "café"],
          ["250 ml", "agua"],
          ["1:16", "proporción"],
        ].map(([v, l]) => (
          <div key={l} className="flex-1 rounded-2xl bg-paper-2 py-4">
            <p className="font-display text-2xl tabular-nums">{v}</p>
            <p className="text-xs text-ink-mute">{l}</p>
          </div>
        ))}
      </div>
      <ol className="mt-6 space-y-4">
        {steps.map(([t, d], i) => (
          <li key={t} className="flex gap-4">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs text-paper tabular-nums">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed">
              <span className="font-medium">{t}.</span> <span className="text-ink-soft">{d}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Related({ product, catalog }: { product: Product; catalog: Catalog }) {
  const pool = catalog.products.filter(
    (p) => p.id !== product.id && p.type !== "preparado" && availability(p, catalog).available,
  );
  // Café → accesorios para prepararlo; accesorio/promo → cafés y otras promos
  const related = (
    product.type === "cafe"
      ? [...pool.filter((p) => p.type === "promocion"), ...pool.filter((p) => p.type === "accesorio")]
      : [...pool.filter((p) => p.type === "cafe"), ...pool.filter((p) => p.type === "promocion")]
  ).slice(0, 4);
  if (!related.length) return null;

  return (
    <section className="mt-20">
      <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
        {product.type === "cafe" ? "Para prepararlo" : "Combina bien con"}
      </h2>
      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
        {related.map((p) => (
          <ProductCard key={p.id} product={p} catalog={catalog} />
        ))}
      </div>
    </section>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto grid max-w-7xl animate-pulse gap-10 px-4 pt-14 sm:px-6 md:grid-cols-2">
      <div className="aspect-square rounded-3xl bg-paper-2" />
      <div className="space-y-4">
        <div className="h-4 w-32 rounded bg-paper-2" />
        <div className="h-12 w-3/4 rounded bg-paper-2" />
        <div className="h-6 w-1/2 rounded bg-paper-2" />
        <div className="mt-8 h-32 rounded-2xl bg-paper-2" />
      </div>
    </div>
  );
}
