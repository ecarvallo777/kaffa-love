"use client";

import { useActionState, useState } from "react";
import { btn, field } from "@/components/admin/ui";
import { saveFairExpenses } from "./actions";

type Expense = { id: string; category: string; concept: string; amountClp: number };
const CATEGORIES = ["Stand", "Transporte", "Comida", "Insumos", "Otro"];
const HINTS: Record<string, string> = {
  Stand: "Arriendo del puesto",
  Transporte: "Uber, bencina, estacionamiento",
  Comida: "Almuerzo, colaciones",
  Insumos: "Vasos, hielo, leche, servilletas",
  Otro: "Cualquier otro gasto",
};
const clp = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);

export function ExpensesEditor({ sessionId, initial }: { sessionId: string; initial: Expense[] }) {
  const [state, action, pending] = useActionState(saveFairExpenses, null);
  const [rows, setRows] = useState<Expense[]>(initial.length ? initial : [{ id: "", category: "Stand", concept: "", amountClp: 0 }]);
  const total = rows.reduce((s, r) => s + (r.amountClp || 0), 0);
  const update = (i: number, patch: Partial<Expense>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={action}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="expenses" value={JSON.stringify(rows)} />
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[150px_1fr_140px_auto]">
            <select value={r.category} onChange={(e) => update(i, { category: e.target.value })} className={field} aria-label="Tipo de gasto">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <input
              value={r.concept}
              onChange={(e) => update(i, { concept: e.target.value })}
              placeholder={HINTS[r.category]}
              className={`${field} max-sm:order-3 max-sm:col-span-2`}
              aria-label="Detalle"
            />
            <input
              inputMode="numeric"
              value={r.amountClp || ""}
              onChange={(e) => update(i, { amountClp: Number(e.target.value.replace(/\D/g, "")) || 0 })}
              placeholder="Monto"
              className={`${field} text-right tabular-nums max-sm:order-2`}
              aria-label="Monto en pesos"
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
              className="rounded-lg px-3 text-accent-deep hover:bg-accent/10 max-sm:order-4"
              aria-label="Quitar gasto"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" onClick={() => setRows([...rows, { id: "", category: c, concept: "", amountClp: 0 }])} className={`${btn.secondary} h-9 px-3`}>
              + {c}
            </button>
          ))}
        </div>
        <p className="text-sm">
          Total gastos: <b className="tabular-nums">{clp(total)}</b>
        </p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button disabled={pending} className={btn.primary}>{pending ? "Guardando…" : "Guardar gastos"}</button>
        {state?.ok && <span role="status" className="text-sm text-leaf">{state.ok}</span>}
        {state?.error && <span role="alert" className="text-sm text-accent-deep">{state.error}</span>}
      </div>
    </form>
  );
}
