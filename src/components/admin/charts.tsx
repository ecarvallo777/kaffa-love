"use client";

import { useState } from "react";

/*
 * Gráficos del dashboard (HTML/CSS, sin librerías).
 * Paleta validada (scripts/validate_palette.js de la guía de visualización):
 *   tienda online #b4432c · feria #3b6fa8 · un solo indicador: #b4432c
 * Barras <= 24 px con punta redondeada, 2 px de separación entre segmentos,
 * grilla tenue, tooltip al pasar o enfocar, leyenda y vista de tabla.
 */

import { SERIES_COLORS } from "@/lib/chart-colors";

const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const compact = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })}M` : n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${n}`;

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-ink-soft">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="size-3 rounded-[3px]" style={{ backgroundColor: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

type Col = { key: string; label: string; values: { key: string; label: string; value: number; color: string }[] };

/** Columnas apiladas en el tiempo (ventas por día/semana/mes y canal) */
export function StackedColumns({ cols, height = 220, caption }: { cols: Col[]; height?: number; caption: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...cols.map((c) => c.values.reduce((s, v) => s + v.value, 0))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(cols.length / 10));
  const series = cols[0]?.values.map((v) => ({ label: v.label, color: v.color })) ?? [];

  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <div className="flex gap-2">
        {/* Eje Y */}
        <div className="relative w-12 shrink-0 text-right text-[11px] text-ink-mute tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / max) * 100}%`, transform: "translateY(50%)" }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line/70" style={{ bottom: `${(t / max) * 100}%` }} aria-hidden />
          ))}
          <div className="absolute inset-0 flex items-end gap-px">
            {cols.map((c, i) => {
              const total = c.values.reduce((s, v) => s + v.value, 0);
              return (
                <button
                  key={c.key}
                  type="button"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${c.label}: ${c.values.map((v) => `${v.label} ${clp(v.value)}`).join(", ")}`}
                  className={`relative flex h-full flex-1 flex-col items-center justify-end outline-none ${hover === i ? "bg-ink/[0.04]" : ""}`}
                >
                  <span className="flex w-full max-w-6 flex-col-reverse gap-[2px]" style={{ height: `${(total / max) * 100}%` }}>
                    {c.values.map((v, j) => {
                      const isTop = c.values.slice(j + 1).every((x) => x.value === 0);
                      return v.value > 0 ? (
                        <span
                          key={v.key}
                          className={isTop ? "rounded-t-[4px]" : ""}
                          style={{ height: `${(v.value / total) * 100}%`, backgroundColor: v.color, minHeight: 2 }}
                        />
                      ) : null;
                    })}
                  </span>
                  {hover === i && (
                    <span
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max rounded-xl bg-ink px-3 py-2 text-left text-xs text-paper shadow-lg ${
                        i > cols.length * 0.7 ? "right-0" : i < cols.length * 0.3 ? "left-0" : "left-1/2 -translate-x-1/2"
                      }`}
                    >
                      <span className="block text-paper/70">{c.label}</span>
                      {c.values.map((v) => (
                        <span key={v.key} className="mt-0.5 flex items-center gap-2">
                          <span className="h-0.5 w-3 rounded" style={{ backgroundColor: v.color }} />
                          <b className="tabular-nums">{clp(v.value)}</b>
                          <span className="text-paper/70">{v.label}</span>
                        </span>
                      ))}
                      <span className="mt-1 block border-t border-paper/20 pt-1 tabular-nums">Total {clp(total)}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {/* Eje X */}
      <div className="ml-14 flex gap-px">
        {cols.map((c, i) => (
          <span key={c.key} className="flex-1 truncate pt-1.5 text-center text-[11px] text-ink-mute">
            {i % labelEvery === 0 ? c.label : ""}
          </span>
        ))}
      </div>
      {series.length > 1 && (
        <div className="mt-3 ml-14">
          <Legend items={series} />
        </div>
      )}
      <TableView
        headers={["Período", ...series.map((s) => s.label), "Total"]}
        rows={cols.map((c) => [c.label, ...c.values.map((v) => clp(v.value)), clp(c.values.reduce((s, v) => s + v.value, 0))])}
      />
    </figure>
  );
}

/** Barras horizontales (rankings): valor al final de la barra */
export function HBars({
  items,
  color = SERIES_COLORS.online,
  unit = "clp",
  caption,
}: {
  items: { label: string; value: number; note?: string }[];
  color?: string;
  /** Cómo mostrar el valor: pesos o unidades */
  unit?: "clp" | "units";
  caption: string;
}) {
  const format = unit === "units" ? (n: number) => `${n} u.` : clp;
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure>
      <figcaption className="sr-only">{caption}</figcaption>
      <ul className="space-y-2.5">
        {items.map((i) => (
          <li key={i.label} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr]" title={`${i.label}: ${format(i.value)}${i.note ? ` · ${i.note}` : ""}`}>
            <span className="truncate text-ink-soft">{i.label}</span>
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 rounded-r-[4px]" style={{ width: `${Math.max(1, (i.value / max) * 100)}%`, maxWidth: "calc(100% - 7rem)", backgroundColor: color }} />
              <span className="shrink-0 tabular-nums">
                {format(i.value)}
                {i.note && <span className="ml-1.5 text-xs text-ink-mute">{i.note}</span>}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Vista de tabla de un gráfico (accesible y para copiar datos) */
export function TableView({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-ink-mute hover:text-ink">Ver tabla</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-paper-2">
            <tr>{headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-line">
                {r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j ? "tabular-nums" : ""}`}>{c}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
