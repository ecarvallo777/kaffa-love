"use client";

import { useActionState, useState } from "react";
import type { Grind } from "@/lib/catalog-types";
import { GRINDS } from "@/lib/grinds";
import { btn, field, textarea } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/action-form";
import { deleteRecipe, saveRecipe } from "./actions";

export type RecipeFormData = {
  id: string;
  title: string;
  method: string;
  coffeeGrams: number;
  waterMl: number;
  temperature: string;
  grind: Grind;
  totalTime: string;
  steps: { title: string; text: string; seconds: number }[];
  notes: string;
  productIds: string[];
  active: boolean;
  featured: boolean;
};

const EMPTY: RecipeFormData = {
  id: "",
  title: "",
  method: "",
  coffeeGrams: 15,
  waterMl: 250,
  temperature: "92–94 °C",
  grind: "media",
  totalTime: "",
  steps: [{ title: "", text: "", seconds: 0 }],
  notes: "",
  productIds: [],
  active: true,
  featured: false,
};

export function RecipeForm({ recipe, coffees }: { recipe: RecipeFormData | null; coffees: { id: string; name: string; active: boolean }[] }) {
  const r = recipe ?? EMPTY;
  const [state, action, pending] = useActionState(saveRecipe, null);
  const [steps, setSteps] = useState(r.steps.length ? r.steps : EMPTY.steps);
  const [grams, setGrams] = useState(String(r.coffeeGrams));
  const [water, setWater] = useState(String(r.waterMl));

  const timer = steps.reduce((s, x) => s + (x.seconds || 0), 0);
  const g = Number(grams.replace(",", "."));
  const w = Number(water.replace(",", "."));
  const ratio = g > 0 && w > 0 ? `1:${(Math.round((w / g) * 10) / 10).toLocaleString("es-CL")}` : "—";

  const updateStep = (i: number, patch: Partial<{ title: string; text: string; seconds: number }>) =>
    setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <form action={action} id="recipe-form" className="space-y-6">
        {r.id && <input type="hidden" name="id" value={r.id} />}
        <input type="hidden" name="steps" value={JSON.stringify(steps)} />

        <Section title="Receta">
          <div className="grid gap-4 sm:grid-cols-2">
            <F label="Título" className="sm:col-span-2" hint='Ej.: "Filtrado en V60" o "Prensa francesa para dos"'>
              <input name="title" required defaultValue={r.title} className={field} />
            </F>
            <F label="Método" hint="Se usa como nombre corto en las pestañas. Ej.: V60, Chemex, Prensa">
              <input name="method" defaultValue={r.method} className={field} />
            </F>
            <F label="Molienda">
              <select name="grind" defaultValue={r.grind} className={field}>
                {GRINDS.map((x) => (
                  <option key={x.value} value={x.value}>{x.label}</option>
                ))}
              </select>
            </F>
          </div>
        </Section>

        <Section title="Medidas" hint="La proporción se calcula sola.">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <F label="Café (g)"><input name="coffeeGrams" inputMode="decimal" required value={grams} onChange={(e) => setGrams(e.target.value)} className={field} /></F>
            <F label="Agua (ml)"><input name="waterMl" inputMode="decimal" required value={water} onChange={(e) => setWater(e.target.value)} className={field} /></F>
            <div>
              <span className="mb-1 block text-sm font-medium">Proporción</span>
              <p className="flex h-11 items-center rounded-xl bg-paper-2 px-3 font-display text-lg tabular-nums">{ratio}</p>
            </div>
            <F label="Temperatura"><input name="temperature" defaultValue={r.temperature} placeholder="92–94 °C" className={field} /></F>
            <F label="Tiempo total" className="col-span-2"><input name="totalTime" defaultValue={r.totalTime} placeholder="2:30 a 3:00 min" className={field} /></F>
          </div>
        </Section>

        <Section title="Pasos">
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 rounded-xl border border-line bg-white p-3">
                <span className="mt-2 grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs text-paper">{i + 1}</span>
                <div className="flex-1 space-y-2">
                  <input value={s.title} onChange={(e) => updateStep(i, { title: e.target.value })} placeholder="Título corto (opcional). Ej.: Pre-infusión" className={field} />
                  <textarea value={s.text} onChange={(e) => updateStep(i, { text: e.target.value })} rows={2} placeholder="Qué hacer en este paso" className={textarea} />
                  <label className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-soft">Duración</span>
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      step={1}
                      value={s.seconds || ""}
                      onChange={(e) => updateStep(i, { seconds: Math.min(3600, Math.max(0, Math.round(Number(e.target.value)) || 0)) })}
                      placeholder="0"
                      aria-label={`Duración del paso ${i + 1} en segundos`}
                      className="h-9 w-24 rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-ink"
                    />
                    <span className="text-ink-mute">
                      segundos{s.seconds ? ` (${mmss(s.seconds)})` : " · paso de preparación, antes del temporizador"}
                    </span>
                  </label>
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg px-2 py-1 text-ink-soft hover:bg-paper-2 disabled:opacity-30" aria-label="Subir paso">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className="rounded-lg px-2 py-1 text-ink-soft hover:bg-paper-2 disabled:opacity-30" aria-label="Bajar paso">↓</button>
                  <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} disabled={steps.length === 1} className="rounded-lg px-2 py-1 text-accent-deep hover:bg-accent/10 disabled:opacity-30" aria-label="Quitar paso">×</button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setSteps([...steps, { title: "", text: "", seconds: 0 }])} className={btn.secondary}>+ Agregar paso</button>
            <span className="text-sm text-ink-soft">
              {timer ? <>Temporizador en la tienda: <b className="tabular-nums">{mmss(timer)}</b></> : "Sin temporizador: ningún paso tiene duración."}
            </span>
          </div>
        </Section>

        <Section title="Nota (opcional)" hint="Un consejo que aparece al final de la receta.">
          <textarea name="notes" rows={2} defaultValue={r.notes} className={textarea} />
        </Section>
      </form>

      <div className="space-y-6">
        <Section title="Cafés" hint="La receta aparece en la ficha de los cafés que marques.">
          <div className="space-y-2">
            {coffees.map((c) => (
              <label key={c.id} className="flex items-center gap-3 text-sm">
                <input form="recipe-form" type="checkbox" name="productIds" value={c.id} defaultChecked={r.productIds.includes(c.id)} className="size-4 accent-accent" />
                <span className={c.active ? "" : "text-ink-mute"}>{c.name}{c.active ? "" : " (inactivo)"}</span>
              </label>
            ))}
            {!coffees.length && <p className="text-sm text-ink-mute">No hay cafés creados.</p>}
          </div>
        </Section>

        <Section title="Visibilidad">
          <label className="mb-3 flex items-start gap-3 text-sm">
            <input form="recipe-form" type="checkbox" name="featured" defaultChecked={r.featured} className="mt-0.5 size-4 accent-accent" />
            <span>
              <span className="block font-medium">Receta destacada</span>
              <span className="block text-xs text-ink-mute">Se muestra primero al abrir el café, antes de que el cliente elija molienda.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input form="recipe-form" type="checkbox" name="active" defaultChecked={r.active} className="mt-0.5 size-4 accent-accent" />
            <span>
              <span className="block font-medium">Visible en la tienda</span>
              <span className="block text-xs text-ink-mute">Desmárcala para guardarla como borrador.</span>
            </span>
          </label>
        </Section>

        <div className="sticky bottom-4 rounded-2xl border border-line bg-paper p-4 shadow-lg">
          {state?.error && <p role="alert" className="mb-3 text-sm text-accent-deep">{state.error}</p>}
          {state?.ok && <p role="status" className="mb-3 text-sm text-leaf">{state.ok}</p>}
          <button form="recipe-form" disabled={pending} className={`${btn.primary} w-full`}>
            {pending ? "Guardando…" : r.id ? "Guardar cambios" : "Crear receta"}
          </button>
        </div>

        {r.id && (
          <ActionForm action={deleteRecipe} confirm={`¿Eliminar la receta "${r.title}"? Dejará de verse en las fichas de los cafés.`}>
            <input type="hidden" name="id" value={r.id} />
            <button className={btn.danger}>Eliminar receta</button>
          </ActionForm>
        )}
      </div>
    </div>
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

function mmss(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
