import { GRINDS } from "@/lib/grinds";
import { GrindGlyph } from "@/components/grind-glyph";

/** Guía de moliendas: ayuda a elegir según el método de preparación */
export function GrindGuide({ compact = false }: { compact?: boolean }) {
  return (
    <section
      id="guia-molienda"
      className={`scroll-mt-32 rounded-3xl bg-ink text-paper ${compact ? "p-6 sm:p-8" : "px-6 py-12 sm:px-12 sm:py-16"}`}
    >
      <div className={compact ? "" : "max-w-xl"}>
        <p className="text-xs tracking-[0.18em] text-crema uppercase">Guía rápida</p>
        <h2 className={`mt-2 font-display ${compact ? "text-2xl" : "text-3xl sm:text-4xl"}`}>
          ¿Qué molienda elijo?
        </h2>
        {!compact && (
          <p className="mt-3 text-paper/70">
            Depende de cómo lo preparas. Mientras más tiempo está el agua en contacto con el café,
            más gruesa la molienda.
          </p>
        )}
      </div>
      <ol className={`grid gap-px overflow-hidden rounded-2xl bg-paper/10 ${compact ? "mt-6 sm:grid-cols-2" : "mt-10 sm:grid-cols-2 lg:grid-cols-4"}`}>
        {GRINDS.map((g) => (
          <li key={g.value} className="bg-ink p-5 sm:p-6">
            <GrindGlyph grind={g.value} className="size-12 text-crema" />
            <h3 className="mt-4 font-display text-xl">{g.label}</h3>
            <p className="mt-1 text-sm font-medium text-paper/90">{g.methods}</p>
            <p className="mt-2 text-sm leading-relaxed text-paper/60">{g.tip}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
