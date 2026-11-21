import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/costs";
import { MP_STATUS_LABEL, type MpExpense } from "@/lib/fair-mp-expenses";
import { ActionForm } from "@/components/admin/action-form";
import { Pill, btn } from "@/components/admin/ui";
import { decideMpExpenseAction, syncMpExpensesAction } from "./actions";

const select = "h-9 rounded-lg border border-line bg-white px-2 text-sm";

function DecideForm({ item, label }: { item: MpExpense; label: string }) {
  return (
    <ActionForm action={decideMpExpenseAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="mpId" value={item.mpId} />
      <select name="category" defaultValue={item.category} className={select} aria-label="Categoría">
        {EXPENSE_CATEGORIES.filter((c) => c !== "Stand").map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
      <select name="status" defaultValue={item.status} className={select} aria-label="Clasificación">
        {(Object.keys(MP_STATUS_LABEL) as (keyof typeof MP_STATUS_LABEL)[]).map((s) => (
          <option key={s} value={s}>{MP_STATUS_LABEL[s]}</option>
        ))}
      </select>
      <label className="flex items-center gap-1 text-xs text-ink-soft">
        <input type="checkbox" name="remember" defaultChecked /> Recordar para este comercio
      </label>
      <button className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-accent">{label}</button>
    </ActionForm>
  );
}

/** Pagos hechos con Mercado Pago en los días de la jornada: por revisar arriba, revisados abajo */
export function MpExpenses({ sessionId, items, enabled }: { sessionId: string; items: MpExpense[]; enabled: boolean }) {
  const counted = items.filter((i) => i.status === "feria").reduce((s, i) => s + i.amountClp, 0);
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const pending = sorted.filter((i) => !i.confirmedAt && !i.byRule);
  const reviewed = sorted.filter((i) => i.confirmedAt || i.byRule);

  return (
    <>
      <p className="text-sm text-ink-soft">
        Lo que pagaste con Mercado Pago desde las 00:00 del día de apertura hasta las 23:59 del cierre se anota solo como gasto (sin factura: resta completo). Se revisa cada 5 minutos.
      </p>

      {pending.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-medium">Por revisar ({pending.length})</h3>
          <ul className="mt-1 divide-y divide-line">
            {pending.map((i) => (
              <li key={i.mpId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{i.detail}</span>
                    <span className="text-ink-mute"> · {fmtDateTime(i.date)}</span>
                  </p>
                  <p className="font-medium tabular-nums">{clp(i.amountClp)}</p>
                </div>
                <DecideForm item={i} label="Confirmar" />
              </li>
            ))}
          </ul>
        </>
      )}

      {reviewed.length > 0 && (
        <>
          <h3 className="mt-5 text-sm font-medium">Revisados</h3>
          <ul className="mt-1 divide-y divide-line">
            {reviewed.map((i) => (
              <li key={i.mpId} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className={i.status === "feria" ? "" : "text-ink-mute"}>{i.detail}</span>
                    <span className="text-ink-mute"> · {fmtDateTime(i.date)}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {i.status === "feria" ? <Pill tone="ok">{i.category}</Pill> : <Pill>{MP_STATUS_LABEL[i.status]}</Pill>}
                    {i.byRule && !i.confirmedAt && <span className="text-xs text-ink-mute">regla</span>}
                    <span className={`tabular-nums ${i.status === "feria" ? "font-medium" : "text-ink-mute line-through"}`}>{clp(i.amountClp)}</span>
                  </div>
                </div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-xs text-ink-mute hover:text-ink">Cambiar</summary>
                  <DecideForm item={i} label="Guardar" />
                </details>
              </li>
            ))}
          </ul>
        </>
      )}

      {!items.length && <p className="mt-4 text-sm text-ink-mute">Sin pagos con Mercado Pago en los días de esta jornada.</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Cuenta como gasto: <strong className="tabular-nums">{clp(counted)}</strong>
          {pending.length > 0 && <span className="text-ink-mute"> (incluye {pending.length} por revisar)</span>}
        </p>
        {enabled && (
          <ActionForm action={syncMpExpensesAction}>
            <input type="hidden" name="sessionId" value={sessionId} />
            <button className={btn.secondary}>Buscar ahora en Mercado Pago</button>
          </ActionForm>
        )}
      </div>
    </>
  );
}
