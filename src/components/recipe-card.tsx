"use client";

import { useState } from "react";
import type { Grind } from "@/lib/catalog-types";
import { grindLabel } from "@/lib/grinds";
import { scrollToGrindSelector, setSelectedGrind, useSelectedGrind } from "@/lib/grind-selection";
import { GrindGlyph } from "@/components/grind-glyph";
import { BrewSteps } from "@/components/brew-timer";

export type RecipeView = {
  id: string;
  title: string;
  method: string;
  coffeeGrams: number;
  waterMl: number;
  ratio: string;
  temperature: string;
  grind: Grind;
  totalTime: string;
  steps: { title: string; text: string; seconds: number }[];
  notes: string;
};

/**
 * Recetas de un café. Muestra la destacada (la primera); cuando la persona elige una
 * molienda, cambia a la receta de esa molienda. Si hay varias, se exploran con pestañas.
 */
export function RecipeTabs({ productId, recipes }: { productId: string; recipes: RecipeView[] }) {
  const grind = useSelectedGrind(productId);
  // Pestaña elegida a mano, recordando para qué molienda se eligió
  const [picked, setPicked] = useState<{ id: string; forGrind: Grind | null } | null>(null);

  const byGrind = grind ? recipes.find((r) => r.grind === grind) : undefined;
  const manual = picked && picked.forGrind === grind ? recipes.find((r) => r.id === picked.id) : undefined;
  const r = manual ?? byGrind ?? recipes[0];
  if (!r) return null;

  const matchesSelection = grind === r.grind;

  return (
    <section id="receta" className="scroll-mt-32 rounded-3xl border border-line p-6 sm:p-8">
      <p className="text-xs tracking-[0.18em] text-accent uppercase">
        {byGrind && r.id === byGrind.id ? `Para molienda ${grindLabel(grind)?.toLowerCase()}` : recipes.length > 1 ? "Recetas sugeridas" : "Receta sugerida"}
      </p>
      {recipes.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Recetas">
          {recipes.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={x.id === r.id}
              onClick={() => setPicked({ id: x.id, forGrind: grind })}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                x.id === r.id ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
              }`}
            >
              {x.method || x.title}
            </button>
          ))}
        </div>
      )}
      <h2 className="mt-3 font-display text-2xl">{r.title}</h2>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        {[
          [`${r.coffeeGrams} g`, "café"],
          [`${r.waterMl} ml`, "agua"],
          [r.ratio, "proporción"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-paper-2 py-4">
            <p className="font-display text-2xl tabular-nums">{v}</p>
            <p className="text-xs text-ink-mute">{l}</p>
          </div>
        ))}
      </div>
      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
        {r.temperature && (
          <div><dt className="inline text-ink-mute">Agua: </dt><dd className="inline">{r.temperature}</dd></div>
        )}
        <div><dt className="inline text-ink-mute">Molienda: </dt><dd className="inline">{grindLabel(r.grind)?.toLowerCase()}</dd></div>
        {r.totalTime && (
          <div><dt className="inline text-ink-mute">Tiempo: </dt><dd className="inline">{r.totalTime}</dd></div>
        )}
      </dl>

      <BrewSteps key={r.id} steps={r.steps} />
      {r.notes && <p className="mt-5 rounded-2xl bg-paper-2 p-4 text-sm text-ink-soft">{r.notes}</p>}

      {/* Lleva la decisión a la compra: marca la molienda correcta en el selector */}
      {matchesSelection ? (
        <p className="mt-6 flex items-center gap-2 text-sm text-leaf">
          <GrindGlyph grind={r.grind} className="size-5" />
          Tu molienda elegida ({grindLabel(r.grind)?.toLowerCase()}) es la indicada para esta receta.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSelectedGrind(productId, r.grind);
            scrollToGrindSelector();
          }}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-accent"
        >
          <GrindGlyph grind={r.grind} className="size-5 text-crema" />
          Usar molienda {grindLabel(r.grind)?.toLowerCase()} para esta receta
        </button>
      )}
    </section>
  );
}
