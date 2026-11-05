import Link from "next/link";
import { getCatalog } from "@/lib/catalog";
import type { Catalog, Product } from "@/lib/catalog-types";
import {
  availability,
  categoryHref,
  clp,
  displayName,
  productHref,
  sortForShop,
  tastingNotes,
  topCategories,
} from "@/lib/catalog-utils";
import { ProductArt } from "@/components/product-art";
import { ProductCard } from "@/components/product-card";
import { GrindGuide } from "@/components/grind-guide";
import { flavorColor } from "@/components/tasting-notes";

export default async function Home() {
  const catalog = await getCatalog();
  const byType = (t: Product["type"]) =>
    sortForShop(
      catalog.products.filter((p) => p.type === t),
      catalog,
    );
  const coffees = byType("cafe");
  const accessories = byType("accesorio");
  const bundles = byType("promocion");
  const featured =
    coffees.find((c) => tastingNotes(c).length > 0 && availability(c, catalog).available) ??
    coffees[0];
  const cats = topCategories(catalog);
  const catSlug = (p?: Product) => cats.find((c) => c.id === p?.category_id);

  return (
    <>
      {featured && <Hero coffee={featured} catalog={catalog} />}

      <ValueStrip />

      {coffees.length > 0 && (
        <Section
          id="cafes"
          eyebrow="Esta temporada"
          title="Nuestros cafés"
          lead="Pocos orígenes a la vez, elegidos por su perfil en taza. Cada bolsa trae 250 g y la molemos como la necesites."
          href={catSlug(coffees[0]) && categoryHref(catSlug(coffees[0])!)}
          linkLabel="Ver todos los cafés"
        >
          <div
            className={`grid gap-x-6 gap-y-12 sm:grid-cols-2 ${coffees.length === 2 ? "lg:gap-x-10" : "lg:grid-cols-3"}`}
          >
            {coffees.map((p) => (
              <ProductCard key={p.id} product={p} catalog={catalog} size="lg" />
            ))}
          </div>
        </Section>
      )}

      <div className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <GrindGuide />
      </div>

      {accessories.length > 0 && (
        <Section
          eyebrow="Cafetería hogar"
          title="Prepara como en una cafetería"
          lead="Lo justo para un buen filtrado en casa."
          href={catSlug(accessories[0]) && categoryHref(catSlug(accessories[0])!)}
          linkLabel="Ver accesorios"
        >
          <div className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-5">
            {accessories.map((p) => (
              <div key={p.id} className="w-[62vw] shrink-0 snap-start sm:w-auto">
                <ProductCard product={p} catalog={catalog} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {bundles.length > 0 && (
        <Section
          eyebrow="Regalos y promociones"
          title="Mejor juntos"
          lead="Combinaciones pensadas para empezar a preparar café de filtro, a mejor precio que por separado."
          href={catSlug(bundles[0]) && categoryHref(catSlug(bundles[0])!)}
          linkLabel="Ver promociones"
        >
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2">
            {bundles.map((p) => (
              <ProductCard key={p.id} product={p} catalog={catalog} size="lg" />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Hero({ coffee, catalog }: { coffee: Product; catalog: Catalog }) {
  const { title } = displayName(coffee);
  const notes = tastingNotes(coffee);
  // Posiciones de las notas flotando alrededor de la bolsa
  const spots = [
    "top-[10%] left-0 sm:left-[4%]",
    "top-[22%] right-0 sm:top-[44%] sm:right-[2%]",
    "bottom-[8%] left-[4%] sm:bottom-[12%] sm:left-[10%]",
  ];

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-20">
        <div className="animate-rise">
          <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">
            Café de especialidad
          </p>
          <h1 className="mt-4 font-display text-[2.75rem] leading-[1.02] font-light tracking-tight text-balance sm:text-6xl lg:text-7xl">
            El buen café <span className="italic">empieza</span> en casa.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Cafés de origen en bolsas de 250 g, molidos para tu método, y los accesorios para
            prepararlos bien.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="#cafes"
              className="inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-accent"
            >
              Elegir mi café
            </Link>
            <Link
              href="#guia-molienda"
              className="inline-flex h-12 items-center rounded-full border border-ink/20 px-6 font-medium transition-colors hover:border-ink"
            >
              ¿Qué molienda necesito?
            </Link>
          </div>
        </div>

        <Link
          href={productHref(coffee)}
          className="group relative block animate-rise [animation-delay:120ms]"
          aria-label={`Ver ${coffee.name}`}
        >
          <div className="relative mx-auto aspect-square max-w-lg rounded-full bg-paper-2">
            <div className="absolute inset-[8%] rounded-full border border-dashed border-line" />
            <ProductArt
              product={coffee}
              catalog={catalog}
              className="transition-transform duration-700 ease-out group-hover:-rotate-2 group-hover:scale-[1.03]"
            />
            {notes.slice(0, 3).map((n, i) => (
              <span
                key={n}
                className={`absolute ${spots[i]} inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs shadow sm:text-sm-[0_6px_20px_-8px_rgba(60,35,15,0.35)]`}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: flavorColor(n) }} />
                {n}
              </span>
            ))}
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs tracking-[0.16em] text-ink-mute uppercase">Destacado</p>
            <p className="mt-1 font-display text-xl">
              {title}
              <span className="text-ink-mute"> · {clp(coffee.price_clp)}</span>
            </p>
          </div>
        </Link>
      </div>
    </section>
  );
}

function ValueStrip() {
  const items = [
    { t: "Molido a tu medida", d: "En grano, fina, media o gruesa" },
    { t: "Retiro sin costo", d: "O despacho a domicilio" },
    { t: "Pago seguro", d: "Con Mercado Pago" },
    { t: "Boleta electrónica", d: "Emitida por Mercado Pago" },
  ];
  return (
    <div className="border-y border-line">
      <ul className="mx-auto grid max-w-7xl grid-cols-2 px-4 sm:px-6 lg:grid-cols-4">
        {items.map((x, i) => (
          <li
            key={x.t}
            className={`py-5 pr-4 ${i % 2 ? "pl-4 sm:pl-6" : ""} ${i > 0 ? "lg:border-l lg:border-line lg:pl-6" : ""} ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${i % 2 ? "border-l border-line" : ""}`}
          >
            <p className="font-display text-lg">{x.t}</p>
            <p className="text-sm text-ink-soft">{x.d}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  lead,
  href,
  linkLabel,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  lead?: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto mt-20 max-w-7xl scroll-mt-32 px-4 sm:mt-24 sm:px-6">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-5xl">{title}</h2>
          {lead && <p className="mt-3 text-ink-soft">{lead}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="group inline-flex items-center gap-2 text-sm font-medium"
          >
            {linkLabel}
            <span className="transition-transform group-hover:translate-x-1" aria-hidden>
              →
            </span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
