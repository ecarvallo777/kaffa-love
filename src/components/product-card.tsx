import Link from "next/link";
import type { Catalog, Product } from "@/lib/catalog-types";
import {
  availability,
  bundleDetails,
  categoryById,
  clp,
  displayName,
  productHref,
  tastingNotes,
} from "@/lib/catalog-utils";
import { ProductArt } from "@/components/product-art";

export function ProductCard({
  product,
  catalog,
  size = "md",
}: {
  product: Product;
  catalog: Catalog;
  size?: "md" | "lg";
}) {
  const { available, low, maxQty } = availability(product, catalog);
  const { title, subtitle } = displayName(product);
  const notes = tastingNotes(product);
  const bundle = product.type === "promocion" ? bundleDetails(product, catalog) : null;

  const eyebrow =
    product.type === "cafe"
      ? [product.origin ?? subtitle, product.process].filter(Boolean).join(" · ")
      : product.type === "promocion"
        ? `Promoción · ${bundle!.items.length} productos`
        : (categoryById(catalog, product.category_id)?.name ?? "Accesorio");

  return (
    <Link href={productHref(product)} className="group block focus-visible:outline-none">
      <div
        className={`relative overflow-hidden rounded-2xl bg-paper-2 transition-shadow duration-300 group-hover:shadow-[0_12px_40px_-12px_rgba(60,35,15,0.35)] group-focus-visible:ring-2 group-focus-visible:ring-accent ${
          size === "lg" ? "aspect-[4/5] sm:aspect-square" : "aspect-[4/5]"
        }`}
      >
        <ProductArt
          product={product}
          catalog={catalog}
          className={`transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
            available ? "" : "opacity-50 grayscale"
          }`}
        />
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {!available && <Badge tone="ink">Agotado</Badge>}
          {available && bundle && bundle.savings > 0 && (
            <Badge tone="accent">Ahorra {clp(bundle.savings)}</Badge>
          )}
          {available && low && maxQty !== null && (
            <Badge tone="paper">
              {maxQty === 1 ? "Última unidad" : `Quedan ${maxQty}`}
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.7rem] font-medium tracking-[0.16em] text-ink-mute uppercase">
            {eyebrow}
          </p>
          <h3
            className={`mt-1 font-display leading-tight text-ink decoration-accent/60 decoration-1 underline-offset-4 group-hover:underline ${
              size === "lg" ? "text-2xl sm:text-3xl" : "text-xl"
            }`}
          >
            {title}
          </h3>
          {notes.length > 0 && (
            <p className="mt-1.5 text-sm text-ink-soft">{notes.join(" · ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-medium tabular-nums">{clp(product.price_clp)}</p>
          {bundle && bundle.savings > 0 && (
            <p className="text-sm text-ink-mute tabular-nums line-through">
              {clp(bundle.regular)}
            </p>
          )}
          {product.type === "cafe" && <p className="text-xs text-ink-mute">250 g</p>}
        </div>
      </div>
    </Link>
  );
}

function Badge({ tone, children }: { tone: "ink" | "accent" | "paper"; children: React.ReactNode }) {
  const tones = {
    ink: "bg-ink text-paper",
    accent: "bg-accent text-white",
    paper: "bg-paper/90 text-ink border border-line",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${tones[tone]}`}>
      {children}
    </span>
  );
}
