import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import {
  categoryHref,
  productsInCategory,
  sortForShop,
  subcategories,
  topCategories,
} from "@/lib/catalog-utils";
import { ProductCard } from "@/components/product-card";
import { GrindGuide } from "@/components/grind-guide";

const INTROS: Record<string, string> = {
  "cafe-de-especialidad":
    "Pocos orígenes a la vez, elegidos por su perfil en taza. Bolsas de 250 g, en grano o molidas para tu método.",
  "cafeteria-hogar": "Cafeteras, teteras y filtros para preparar café de especialidad en casa.",
  regalos: "Combinaciones listas para regalar o para empezar, a mejor precio que por separado.",
};

export async function generateStaticParams() {
  const catalog = await getCatalog();
  return catalog.categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(props: PageProps<"/categoria/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const catalog = await getCatalog();
  const category = catalog.categories.find((c) => c.slug === slug);
  return category
    ? { title: category.name, description: INTROS[slug] ?? `${category.name} en Kaffa Love.` }
    : {};
}

export default function CategoryPage(props: PageProps<"/categoria/[slug]">) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryView params={props.params} />
    </Suspense>
  );
}

async function CategoryView({ params }: Pick<PageProps<"/categoria/[slug]">, "params">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const category = catalog.categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const root = category.parent_id
    ? catalog.categories.find((c) => c.id === category.parent_id)!
    : category;
  const products = sortForShop(productsInCategory(catalog, category), catalog);
  const subs = subcategories(catalog, root);
  const siblings = topCategories(catalog).filter((c) => c.id !== root.id);
  const isCoffee = products.some((p) => p.type === "cafe");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="pt-10 pb-8 sm:pt-14">
        <nav aria-label="Ruta" className="text-sm text-ink-mute">
          <Link href="/" className="hover:text-ink">
            Inicio
          </Link>
          {category.parent_id && (
            <>
              <span className="mx-2">/</span>
              <Link href={categoryHref(root)} className="hover:text-ink">
                {root.name}
              </Link>
            </>
          )}
        </nav>
        <h1 className="mt-4 font-display text-4xl font-light tracking-tight sm:text-6xl">
          {category.name}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-ink-soft">
          {INTROS[slug] ?? INTROS[root.slug] ?? ""}
        </p>
      </div>

      {subs.length > 0 && (
        <div className="-mx-4 mb-10 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <Chip href={categoryHref(root)} active={category.id === root.id}>
            Todo
          </Chip>
          {subs.map((s) => (
            <Chip key={s.id} href={categoryHref(s)} active={s.id === category.id}>
              {s.name}
            </Chip>
          ))}
        </div>
      )}

      <p className="mb-6 text-sm text-ink-mute">
        {products.length} {products.length === 1 ? "producto" : "productos"}
      </p>

      {products.length ? (
        <div
          className={`grid gap-x-6 gap-y-12 ${isCoffee ? (products.length === 2 ? "sm:grid-cols-2 lg:gap-x-10" : "sm:grid-cols-2 lg:grid-cols-3") : "grid-cols-2 lg:grid-cols-4"}`}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} catalog={catalog} size={isCoffee ? "lg" : "md"} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-paper-2 p-10 text-center text-ink-soft">
          Pronto tendremos productos en esta categoría.
        </p>
      )}

      {isCoffee && (
        <div className="mt-20">
          <GrindGuide />
        </div>
      )}

      {siblings.length > 0 && (
        <div className="mt-20 grid gap-4 sm:grid-cols-2">
          {siblings.map((c) => (
            <Link
              key={c.id}
              href={categoryHref(c)}
              className="group flex items-center justify-between rounded-2xl border border-line p-6 transition-colors hover:border-ink hover:bg-paper-2"
            >
              <span>
                <span className="block text-xs tracking-[0.16em] text-ink-mute uppercase">
                  Sigue explorando
                </span>
                <span className="mt-1 block font-display text-2xl">{c.name}</span>
              </span>
              <span className="text-xl transition-transform group-hover:translate-x-1" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function CategorySkeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 pt-14 sm:px-6">
      <div className="h-4 w-24 rounded bg-paper-2" />
      <div className="mt-6 h-14 w-80 max-w-full rounded bg-paper-2" />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="aspect-[4/5] rounded-2xl bg-paper-2" />
        ))}
      </div>
    </div>
  );
}
