"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import type { InventoryRow } from "@/lib/inventory";
import { btn, field } from "@/components/admin/ui";
import { applyCount } from "./actions";

const DRAFT_KEY = "kaffa-inventario-borrador";
const TYPE_LABEL: Record<string, string> = { cafe: "Café", accesorio: "Accesorios", preparado: "Preparados de feria" };

export function CountSheet({ rows }: { rows: InventoryRow[] }) {
  const [state, action, pending] = useActionState(applyCount, null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [reason, setReason] = useState<"ajuste" | "compra">("ajuste");

  // Conteo parcial guardado en este navegador (por si se recarga la página)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as Record<string, string> | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- carga única del borrador
      if (saved) setCounts(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(counts));
    } catch {}
  }, [counts]);
  // Al aplicar con éxito se limpia el borrador
  useEffect(() => {
    if (!state?.results) return;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicio tras aplicar
    setCounts({});
  }, [state]);

  const parsed = (id: string) => {
    const v = counts[id];
    if (v === undefined || v.trim() === "") return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  const summary = useMemo(() => {
    let counted = 0;
    let withDiff = 0;
    let units = 0;
    for (const r of rows) {
      const c = parsed(r.id);
      if (c === null) continue;
      counted++;
      if (c !== r.expected) {
        withDiff++;
        units += c - r.expected;
      }
    }
    return { counted, withDiff, units };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, rows]);

  const visible = rows.filter((r) => {
    if (query && !r.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (onlyDiff) {
      const c = parsed(r.id);
      return c !== null && c !== r.expected;
    }
    return true;
  });
  const groups = [...new Set(visible.map((r) => r.type))];

  const payload = JSON.stringify(
    rows.map((r) => ({ productId: r.id, counted: parsed(r.id) })).filter((c) => c.counted !== null),
  );

  return (
    <form action={action}>
      <input type="hidden" name="counts" value={payload} />
      <input type="hidden" name="reason" value={reason} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto"
          className={`${field} max-w-xs`}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="size-4 accent-accent" />
          Solo con diferencias
        </label>
        <p className="ml-auto text-sm text-ink-soft">
          “Debería haber” = disponible + comprometido en pedidos por entregar.
        </p>
      </div>

      <div className="space-y-6">
        {groups.map((type) => (
          <section key={type}>
            <h2 className="mb-2 text-xs tracking-[0.16em] text-ink-mute uppercase">{TYPE_LABEL[type] ?? type}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white/60">
              {visible
                .filter((r) => r.type === type)
                .map((r) => {
                  const c = parsed(r.id);
                  const diff = c === null ? null : c - r.expected;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-ink-mute tabular-nums">
                          Disponible {r.available}
                          {r.committed > 0 && <> · comprometido {r.committed}</>} · <b className="text-ink-soft">debería haber {r.expected}</b>
                        </p>
                      </div>
                      <label className="flex items-center gap-2">
                        <span className="text-sm text-ink-soft">Hay</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={counts[r.id] ?? ""}
                          onChange={(e) => setCounts((s) => ({ ...s, [r.id]: e.target.value }))}
                          placeholder={String(r.expected)}
                          aria-label={`Unidades contadas de ${r.name}`}
                          className="h-12 w-24 rounded-xl border border-line bg-white px-3 text-center text-lg tabular-nums outline-none focus:border-ink"
                        />
                      </label>
                      <span
                        className={`w-20 text-right text-sm font-medium tabular-nums ${
                          diff === null ? "text-ink-mute" : diff === 0 ? "text-leaf" : diff > 0 ? "text-[#2f4a68]" : "text-accent-deep"
                        }`}
                      >
                        {diff === null ? "—" : diff === 0 ? "✓ cuadra" : diff > 0 ? `+${diff}` : diff}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
        {!visible.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-soft">No hay productos para mostrar.</p>}
      </div>

      <div className="sticky bottom-4 mt-6 rounded-2xl border border-line bg-paper p-4 shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm">
            <b>{summary.counted}</b> contados · <b>{summary.withDiff}</b> con diferencia
            {summary.withDiff > 0 && (
              <span className="text-ink-soft tabular-nums"> ({summary.units > 0 ? "+" : ""}{summary.units} unidades)</span>
            )}
          </p>
          <div className="flex rounded-full bg-paper-2 p-1 text-sm" role="radiogroup" aria-label="Motivo">
            {(
              [
                ["ajuste", "Conteo / ajuste"],
                ["compra", "Llegó mercadería"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={reason === v}
                onClick={() => setReason(v)}
                className={`rounded-full px-3 py-1.5 ${reason === v ? "bg-ink text-paper" : "text-ink-soft"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <input name="note" placeholder="Nota (opcional): proveedor, merma…" className={`${field} h-10 max-w-xs flex-1`} />
          <button
            disabled={pending || summary.counted === 0}
            onClick={(e) => {
              if (!confirm(`¿Aplicar el conteo? Se registrarán ${summary.withDiff} diferencias en el stock.`)) e.preventDefault();
            }}
            className={btn.primary}
          >
            {pending ? "Aplicando…" : "Aplicar conteo"}
          </button>
        </div>
        {state?.error && <p role="alert" className="mt-3 text-sm text-accent-deep">{state.error}</p>}
        {state?.results && (
          <div role="status" className="mt-3 text-sm">
            <p className="font-medium text-leaf">
              Conteo aplicado: {state.results.filter((r) => r.delta !== 0 && !r.error).length} ajustes registrados,{" "}
              {state.results.filter((r) => r.delta === 0).length} cuadraban.
            </p>
            {state.results
              .filter((r) => r.error)
              .map((r) => (
                <p key={r.name} className="mt-1 text-accent-deep">
                  {r.name}: {r.error}
                </p>
              ))}
          </div>
        )}
      </div>
    </form>
  );
}
