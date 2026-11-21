import { clp } from "@/lib/catalog-utils";
import type { FairProfit } from "@/lib/fair-profit";

const weekday = new Intl.DateTimeFormat("es-CL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const label = (date: string) => weekday.format(new Date(`${date}T12:00:00Z`));

/** Qué se vendió cada día de la jornada: productos en filas, días en columnas (unidades) */
export function SalesByDay({ fp }: { fp: FairProfit }) {
  if (!fp.days.length) return <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">Aún no hay ventas.</p>;
  const best = (productId: string) => {
    const units = fp.days.map((d) => d.byProduct[productId]?.units ?? 0);
    const max = Math.max(...units);
    return max > 0 && units.filter((u) => u === max).length === 1 ? max : null;
  };
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-mute">
            <th className="px-3 py-2 font-medium">Producto</th>
            {fp.days.map((d) => (
              <th key={d.date} className="px-3 py-2 text-right font-medium whitespace-nowrap capitalize">{label(d.date)}</th>
            ))}
            {fp.days.length > 1 && <th className="px-3 py-2 text-right font-medium">Total</th>}
          </tr>
        </thead>
        <tbody>
          {fp.products.map((p) => {
            const top = best(p.productId);
            return (
              <tr key={p.productId} className="border-b border-line/60">
                <td className="px-3 py-2">{p.name}</td>
                {fp.days.map((d) => {
                  const x = d.byProduct[p.productId];
                  return (
                    <td key={d.date} className={`px-3 py-2 text-right tabular-nums ${!x ? "text-ink-mute" : top !== null && x.units === top && fp.days.length > 1 ? "font-semibold text-leaf" : ""}`} title={x ? clp(x.revenue) : undefined}>
                      {x ? x.units : "—"}
                    </td>
                  );
                })}
                {fp.days.length > 1 && <td className="px-3 py-2 text-right font-medium tabular-nums">{p.units}</td>}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="text-ink-soft">
            <td className="px-3 py-2">Ventas</td>
            {fp.days.map((d) => (
              <td key={d.date} className="px-3 py-2 text-right tabular-nums">{d.sales}</td>
            ))}
            {fp.days.length > 1 && <td className="px-3 py-2 text-right tabular-nums">{fp.days.reduce((s, d) => s + d.sales, 0)}</td>}
          </tr>
          <tr className="font-medium">
            <td className="px-3 py-2">Total vendido</td>
            {fp.days.map((d) => (
              <td key={d.date} className="px-3 py-2 text-right tabular-nums">{clp(d.gross)}</td>
            ))}
            {fp.days.length > 1 && <td className="px-3 py-2 text-right tabular-nums">{clp(fp.days.reduce((s, d) => s + d.gross, 0))}</td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
