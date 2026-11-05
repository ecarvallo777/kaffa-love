import type { Catalog, Product } from "@/lib/catalog-types";
import { bundleDetails, displayName } from "@/lib/catalog-utils";

/*
 * Ilustraciones provisorias mientras no haya fotos de producto.
 * Si el producto tiene image_urls, se usa la primera foto.
 */

const LABEL_COLORS = ["#b4432c", "#3d5944", "#c4873a", "#2f4a68", "#7a4b6e", "#a35d2a"];

function colorFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LABEL_COLORS[h % LABEL_COLORS.length];
}

export function ProductArt({
  product,
  catalog,
  className = "",
}: {
  product: Product;
  catalog: Catalog;
  className?: string;
}) {
  if (product.image_urls[0]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.image_urls[0]}
        alt={product.name}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`@container relative grid h-full w-full place-items-center ${className}`}
      aria-hidden
    >
      {/* Luz suave detrás del producto */}
      <div className="absolute inset-[12%] rounded-full bg-white/35 blur-2xl" />
      {product.type === "cafe" && <CoffeeBag product={product} />}
      {product.type === "accesorio" && (
        <div className="relative w-[58%] text-ink">
          <AccessoryIcon slug={product.slug} />
        </div>
      )}
      {product.type === "promocion" && <BundleArt product={product} catalog={catalog} />}
    </div>
  );
}

function CoffeeBag({ product }: { product: Product }) {
  const { title, subtitle } = displayName(product);
  const label = colorFor(product.slug);
  return (
    <div className="relative aspect-[3/4] w-[54%] drop-shadow-[0_18px_22px_rgba(60,35,15,0.28)]">
      {/* Bolsa kraft */}
      <div
        className="absolute inset-0 rounded-[6%_6%_9%_9%/4%_4%_6%_6%]"
        style={{
          background:
            "linear-gradient(100deg, #b98f60 0%, #d3b088 18%, #c9a274 46%, #b48858 78%, #a57b4d 100%)",
        }}
      />
      {/* Sello superior */}
      <div
        className="absolute inset-x-0 top-0 h-[9%] rounded-t-[6%] opacity-70"
        style={{
          background:
            "repeating-linear-gradient(90deg, rgba(70,40,15,.35) 0 2px, transparent 2px 6px)",
        }}
      />
      <div className="absolute inset-x-[4%] top-[11%] h-px bg-black/20" />
      {/* Válvula */}
      <div className="absolute top-[16%] left-1/2 aspect-square w-[9%] -translate-x-1/2 rounded-full border border-black/15 bg-[#c39a6b]" />
      {/* Etiqueta */}
      <div
        className="absolute inset-x-[11%] top-[28%] bottom-[10%] flex flex-col items-center justify-between rounded-[4px] px-[6%] py-[7%] text-center text-white"
        style={{ backgroundColor: label }}
      >
        <span className="text-[3.2cqw] font-semibold tracking-[0.25em] uppercase opacity-90">
          Kaffa Love
        </span>
        <span className="font-display text-[6.4cqw] leading-[1.05] font-medium italic">
          {title}
        </span>
        <span className="flex w-full flex-col items-center gap-[1cqw]">
          <span className="h-px w-1/3 bg-white/50" />
          <span className="text-[3cqw] tracking-[0.2em] uppercase opacity-90">
            {product.origin ?? subtitle ?? "Especialidad"}
          </span>
          <span className="text-[2.8cqw] opacity-75">250 g</span>
        </span>
      </div>
    </div>
  );
}

function BundleArt({ product, catalog }: { product: Product; catalog: Catalog }) {
  const { items } = bundleDetails(product, catalog);
  const shown = items.slice(0, 3);
  const width = shown.length >= 3 ? "w-[31%]" : "w-[42%]";
  return (
    <div className="relative flex h-full w-full items-center justify-center px-[8%]">
      {/* Sombra de "mesa" para que se lean como un conjunto */}
      <div className="absolute top-[64%] h-[4%] w-[72%] rounded-full bg-[#5a3a1e]/12 blur-md" />
      <div className="relative flex w-full items-end justify-center gap-[3%]">
        {shown.map((x) => (
          <div key={x.product.id} className={`text-ink ${width}`}>
            <AccessoryIcon slug={x.product.slug} />
          </div>
        ))}
      </div>
    </div>
  );
}

const stroke = {

  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function AccessoryIcon({ slug }: { slug: string }) {
  const s = slug.toLowerCase();

  if (s.includes("chemex")) {
    return (
      <svg viewBox="0 0 100 110" className="h-auto w-full" fill="none">
        <path
          d="M28 10 H72 L55 50 V54 L73 94 Q74 100 67 100 H33 Q26 100 27 94 L45 54 V50 Z"
          fill="#fbf7f0"
          fillOpacity=".7"
          {...stroke}
        />
        <path d="M38 76 Q50 72 62 76" {...stroke} strokeWidth={1.4} opacity=".5" />
        <path d="M33 88 H67" {...stroke} strokeWidth={1.4} opacity=".4" />
        <path d="M40 40 H60 L57 60 H43 Z" fill="#9b6a3f" {...stroke} />
        <path d="M43 50 Q50 54 57 50" {...stroke} strokeWidth={1.6} />
        <circle cx="61" cy="56" r="2.6" fill="#9b6a3f" {...stroke} strokeWidth={1.6} />
        <path d="M28 10 L22 14" {...stroke} />
      </svg>
    );
  }

  if (s.includes("v60") || s.includes("dripper")) {
    return (
      <svg viewBox="0 0 100 100" className="h-auto w-full" fill="none">
        <path d="M18 22 H82 L60 64 H40 Z" fill="#fbf7f0" fillOpacity=".75" {...stroke} />
        <path d="M30 30 L44 58 M50 30 V58 M70 30 L56 58" {...stroke} strokeWidth={1.4} opacity=".45" />
        <path d="M80 30 Q94 32 90 46 Q86 56 70 50" {...stroke} />
        <path d="M28 64 H72 Q74 64 74 67 Q74 70 72 70 H28 Q26 70 26 67 Q26 64 28 64 Z" fill="#fbf7f0" {...stroke} />
        <path d="M44 70 V76 M56 70 V76" {...stroke} />
        <path d="M34 78 H66 L63 94 Q62 96 59 96 H41 Q38 96 37 94 Z" fill="#9b6a3f" fillOpacity=".25" {...stroke} />
      </svg>
    );
  }

  if (s.includes("tetera") || s.includes("hervidor") || s.includes("kettle")) {
    return (
      <svg viewBox="0 0 110 100" className="h-auto w-full" fill="none">
        <path d="M36 44 Q36 38 44 38 H74 Q82 38 82 46 L84 86 Q84 92 78 92 H40 Q34 92 34 86 Z" fill="#fbf7f0" fillOpacity=".75" {...stroke} />
        <path d="M44 38 Q59 26 74 38" fill="#fbf7f0" {...stroke} />
        <circle cx="59" cy="28" r="3.5" fill="#9b6a3f" {...stroke} strokeWidth={1.8} />
        <path d="M82 50 Q100 50 98 66 Q96 80 84 80" {...stroke} strokeWidth={4} />
        <path d="M36 82 Q18 80 16 62 Q14 46 4 40" {...stroke} strokeWidth={3} />
        <path d="M34 62 H84" {...stroke} strokeWidth={1.4} opacity=".4" />
      </svg>
    );
  }

  if (s.includes("filtro")) {
    return (
      <svg viewBox="0 0 100 100" className="h-auto w-full" fill="none">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${20 + i * 6} ${24 + i * 8} H${74 + i * 6} L${58 + i * 6} ${80 + i * 4} H${38 + i * 6} Z`}
            fill="#fbf7f0"
            {...stroke}
            strokeWidth={2}
          />
        ))}
      </svg>
    );
  }

  // Taza (genérico)
  return (
    <svg viewBox="0 0 100 100" className="h-auto w-full" fill="none">
      <path d="M24 38 H72 L68 80 Q67 88 58 88 H38 Q29 88 28 80 Z" fill="#fbf7f0" fillOpacity=".75" {...stroke} />
      <path d="M71 48 Q86 48 84 62 Q82 72 69 72" {...stroke} />
      <path d="M40 28 Q36 22 40 16 M50 28 Q46 20 50 12 M60 28 Q56 22 60 16" {...stroke} strokeWidth={1.8} opacity=".5" />
      <path d="M14 92 H86" {...stroke} />
    </svg>
  );
}
