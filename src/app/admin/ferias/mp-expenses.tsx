import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/costs";
import { MP_STATUS_LABEL, type MpExpense } from "@/lib/fair-mp-expenses";
import { ActionForm } from "@/components/admin/action-form";
import { btn } from "@/components/admin/ui";
import { decideMpExpenseAction, syncMpExpensesAction } from "./actions";

const select = "h-9 rounded-lg border border-line bg-white px-2 text-sm";

/** Pagos hechos con Mercado Pago en los días de la jornada, ya anotados como gastos */
export function MpExpenses({ sessionId, items, enabled }: { sessionId: string; items: MpExpense[]; enabled: boolean }) {
  const counted = items.filter((i) => i.status === "feria").reduce((s, i) => s + i.amountClp, 0);
  return (
    <>
      <p className="text-sm text-ink-soft">
        Lo que pagaste con Mercado Pago desde las 00:00 del día de apertura hasta las 23:59 del cierre se anota solo como gasto (sin factura: resta completo). Se revisa cada 5 minutos.
      </p>
      {items.length > 0 ? (
        <ul className="mt-4 divide-y divide-line">
          {[...items]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((i) => (
              <li key={i.mpId} className={`py-3 ${i.status === "feria" ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{i.detail}</span>
                    <span className="text-ink-mute"> · {fmtDateTime(i.date)}</span>
                  </p>
                  <p className={`tabular-nums ${i.status === "feria" ? "font-medium" : "line-through"}`}>{clp(i.amountClp)}</p>
                </div>
                <ActionForm action={decideMpExpenseAction} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="mpId" value={i.mpId} />
                  <select name="category" defaultValue={i.category} className={select} aria-label="Categoría">
                    {EXPENSE_CATEGORIES.filter((c) => c !== "Stand").map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <select name="status" defaultValue={i.status} className={select} aria-label="Clasificación">
                    {(Object.keys(MP_STATUS_LABEL) as (keyof typeof MP_STATUS_LABEL)[]).map((s) => (
                      <option key={s} value={s}>{MP_STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs text-ink-soft">
                    <input type="checkbox" name="remember" defaultChecked /> Recordar para este comercio
                  </label>
                  <button className="h-9 rounded-full border border-line bg-white px-4 text-sm hover:border-ink">Guardar</button>
                  {i.byRule && <span className="text-xs text-ink-mute">(clasificado por una regla recordada)</span>}
                </ActionForm>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-mute">Sin pagos con Mercado Pago en los días de esta jornada.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Cuenta como gasto: <strong className="tabular-nums">{clp(counted)}</strong>
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
