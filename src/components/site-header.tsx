import Link from "next/link";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import { categoryHref, topCategories } from "@/lib/catalog-utils";
import { CartButton } from "@/components/cart-button";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className="bg-ink text-paper">
        <p className="mx-auto max-w-7xl px-4 py-2 text-center text-xs tracking-wide sm:px-6">
          Despacho a domicilio o <strong className="font-medium">retiro sin costo</strong>
          <span className="max-sm:hidden">
            <span className="mx-2 text-paper/40">·</span>
            Paga seguro con Mercado Pago
          </span>
        </p>
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Kaffa Love, inicio">
          <Wordmark />
        </Link>
        <nav
          aria-label="Categorías"
          className="-mx-1 flex min-h-8 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] max-md:order-last max-md:basis-full"
        >
          <Suspense>
            <CategoryLinks />
          </Suspense>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/cuenta"
            className="grid size-10 place-items-center rounded-full transition-colors hover:bg-paper-2"
            aria-label="Mi cuenta"
            title="Mi cuenta"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" strokeLinecap="round" />
            </svg>
          </Link>
          <CartButton />
        </div>
      </div>
    </header>
  );
}

async function CategoryLinks() {
  const categories = topCategories(await getCatalog());
  return categories.map((c) => (
    <Link
      key={c.id}
      href={categoryHref(c)}
      className="shrink-0 rounded-full px-3 py-1.5 text-sm text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
    >
      {c.name}
    </Link>
  ));
}
