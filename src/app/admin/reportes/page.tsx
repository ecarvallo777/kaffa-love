import { connection } from "next/server";
import Link from "next/link";
import { clp } from "@/lib/catalog-utils";
import { fmtDate } from "@/lib/format";
import { grindLabel } from "@/lib/grinds";
import { getReport, PERIODS, type Channel, type PeriodKey, type Report } from "@/lib/reports";
import { Card, PageHeader } from "@/components/admin/ui";
import { HBars, Legend, StackedColumns, TableView } from "@/components/admin/charts";
import { SERIES_COLORS } from "@/lib/chart-colors";

export const metadata = { title: "Reportes" };

const PERIOD_LABEL: Record<PeriodKey, string> = { "7d": "7 días", "30d": "30 días", "90d": "90 días", "12m": "12 meses" };
const CHANNEL_LABEL: Record<Channel, string> = { todos: "Todo", online: "Tienda online", feria: "Feria" };
const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)} %`);

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reportes">) {
  await connection();
  const sp = await searchParams;
  const period = (Object.keys(PERIODS) as PeriodKey[]).includes(sp.p as PeriodKey) ? (sp.p as PeriodKey) : "30d";
  const channel: Channel = sp.c === "online" || sp.c === "feria" ? sp.c : "todos";
  const r = await getReport(period, channel);
  const href = (p: PeriodKey, c: Channel) => `/admin/reportes?p=${p}&c=${c}`;
  const showOnline = channel !== "feria";
  const showFair = channel !== "online";

  return (
    <>
      <PageHeader title="Reportes" description={`Del ${fmtDate(r.from)} al ${fmtDate(r.to)}, comparado con el período anterior de igual duración.`} />

      {/* Filtros: una fila arriba de todo */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(Object.keys(PERIODS) as PeriodKey[]).map((p) => (
          <Link key={p} href={href(p, channel)} className={`rounded-full border px-3 py-1.5 text-sm ${p === period ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {PERIOD_LABEL[p]}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" />
        {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
          <Link key={c} href={href(period, c)} className={`rounded-full border px-3 py-1.5 text-sm ${c === channel ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {CHANNEL_LABEL[c]}
          </Link>
        ))}
      </div>

      {(r.missingCost.length > 0 || r.commissionsMissing) && (
        <p className="mb-6 rounded-2xl bg-crema/15 px-4 py-3 text-sm text-[#8a5a1c]">
          La utilidad es aproximada:{" "}
          {r.missingCost.length > 0 && <>faltan costos de {r.missingCost.slice(0, 4).join(", ")}{r.missingCost.length > 4 ? ` y ${r.missingCost.length - 4} más` : ""} (<Link href="/admin/productos" className="underline">Productos</Link>). </>}
          {r.commissionsMissing && <>Falta la comisión de Mercado Pago (<Link href="/admin/configuracion" className="underline">Configuración</Link>).</>}
        </p>
      )}

      {/* Indicadores */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Tile label="Ventas" value={clp(r.current.gross)} now={r.current.gross} before={r.previous.gross} />
        <Tile label="Utilidad real" value={clp(r.current.profit)} now={r.current.profit} before={r.previous.profit} hint={r.missingCost.length ? "Margen aprox.: faltan costos" : `Margen ${pct(r.current.margin)}`} />
        <Tile label="Pedidos y ventas" value={String(r.current.orders)} now={r.current.orders} before={r.previous.orders} />
        <Tile label="Ticket promedio" value={clp(r.avgTicket)} now={r.avgTicket} before={r.prevAvgTicket} />
        <Tile label="Unidades vendidas" value={String(r.current.units)} now={r.current.units} before={r.previous.units} />
      </div>

      <Insights r={r} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title={`Ventas por ${r.bucketUnit}`}>
          {r.current.orders ? (
            <StackedColumns
              caption={`Ventas por ${r.bucketUnit} y canal`}
              cols={r.series.map((b) => ({
                key: b.key,
                label: b.label,
                values: [
                  ...(showOnline ? [{ key: "online", label: "Tienda online", value: b.online, color: SERIES_COLORS.online }] : []),
                  ...(showFair ? [{ key: "feria", label: "Feria", value: b.feria, color: SERIES_COLORS.feria }] : []),
                ],
              }))}
            />
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Utilidad del período">
          <dl className="divide-y divide-line text-sm">
            {(
              [
                ["Ventas (con IVA)", r.current.gross],
                ["IVA", -r.current.iva],
                ["Costo de productos", -r.current.productCost],
                ["Comisión Mercado Pago", -r.current.commission],
                ["Gastos de ferias", -r.current.expenses],
              ] as [string, number][]
            ).map(([l, v]) => (
              <div key={l} className="flex justify-between py-2">
                <dt className="text-ink-soft">{l}</dt>
                <dd className="tabular-nums">{v < 0 ? `− ${clp(-v)}` : clp(Math.abs(v))}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-3">
              <dt className="font-display text-lg">Utilidad</dt>
              <dd className={`font-display text-2xl tabular-nums ${r.current.profit < 0 ? "text-accent-deep" : "text-leaf"}`}>{clp(r.current.profit)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Productos que más venden">
          {r.products.length ? (
            <>
              <HBars
                caption="Ventas por producto"
                items={r.products.slice(0, 8).map((p) => ({ label: p.name, value: p.revenue, note: `${p.units} u. · margen ${pct(p.margin)}` }))}
              />
              <TableView
                headers={["Producto", "Unidades", "Ventas", "Utilidad bruta", "Margen"]}
                rows={r.products.map((p) => [p.name, p.units, clp(p.revenue), p.profit === null ? "sin costo" : clp(p.profit), pct(p.margin)])}
              />
            </>
          ) : (
            <Empty />
          )}
        </Card>

        <Card title="Moliendas preferidas">
          {r.grinds.some((g) => g.units) ? (
            <HBars
              caption="Unidades de café por molienda"
              unit="units"
              items={r.grinds.map((g) => ({ label: grindLabel(g.grind) ?? g.grind, value: g.units, note: pct(g.units / Math.max(1, r.grinds.reduce((s, x) => s + x.units, 0))) }))}
            />
          ) : (
            <Empty />
          )}
          <p className="mt-4 text-xs text-ink-mute">Útil para planificar cuánto moler de cada tipo antes de cada tueste o feria.</p>
        </Card>
      </div>

      {showOnline && (
        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card title="Embudo de la tienda online">
            <Funnel f={r.funnel} />
          </Card>
          <Card title="Clientes online">
            <dl className="grid grid-cols-2 gap-3 text-center">
              {(
                [
                  ["Compraron", r.customers.buyers],
                  ["Nuevos", r.customers.newBuyers],
                  ["Volvieron", r.customers.returning],
                  ["Compraron 2+ veces", pct(r.customers.repeatRate)],
                ] as [string, string | number][]
              ).map(([l, v]) => (
                <div key={l} className="rounded-xl bg-paper-2 p-3">
                  <dt className="text-xs text-ink-mute">{l}</dt>
                  <dd className="font-display text-2xl tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink-mute">“Volvieron”: ya habían comprado antes de este período.</p>
          </Card>
          <Card title="Dónde están los clientes">
            {r.communes.length ? (
              <>
                <HBars caption="Ventas online por comuna" items={r.communes.map((c) => ({ label: c.name, value: c.revenue, note: `${c.orders} ped.` }))} />
                <p className="mt-3 text-xs text-ink-mute">
                  Retiro {r.delivery.retiro} · despacho {r.delivery.despacho} pedidos.
                </p>
              </>
            ) : (
              <Empty />
            )}
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Ventas por día de la semana">
          {r.current.orders ? (
            <StackedColumns
              height={160}
              caption="Ventas por día de la semana y canal"
              cols={r.weekdays.map((w) => ({
                key: w.day,
                label: w.day,
                values: [
                  ...(showOnline ? [{ key: "online", label: "Tienda online", value: w.online, color: SERIES_COLORS.online }] : []),
                  ...(showFair ? [{ key: "feria", label: "Feria", value: w.feria, color: SERIES_COLORS.feria }] : []),
                ],
              }))}
            />
          ) : (
            <Empty />
          )}
        </Card>
        {showFair && (
          <Card title="Horas de más venta en feria">
            {r.fairHours.length ? (
              <HBars
                caption="Ventas de feria por hora"
                color={SERIES_COLORS.feria}
                items={r.fairHours.map((h) => ({ label: `${String(h.hour).padStart(2, "0")}:00 – ${String(h.hour + 1).padStart(2, "0")}:00`, value: h.revenue, note: `${h.sales} ${h.sales === 1 ? "venta" : "ventas"}` }))}
              />
            ) : (
              <Empty />
            )}
          </Card>
        )}
      </div>

      {showFair && (
        <Card title="Ferias del período: ¿cuáles conviene repetir?" className="mt-6">
          {r.fairs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-ink-mute uppercase">
                  <tr><th className="py-2">Feria</th><th className="py-2 text-right">Ventas</th><th className="py-2 text-right">Ticket prom.</th><th className="py-2 text-right">Utilidad</th><th className="py-2 text-right">Margen</th><th className="py-2 text-right">Utilidad / hora</th></tr>
                </thead>
                <tbody>
                  {r.fairs.map((f) => (
                    <tr key={f.id} className="border-t border-line">
                      <td className="py-2">
                        <Link href={`/admin/ferias/${f.id}`} className="font-medium underline-offset-4 hover:underline">{f.name}</Link>
                        <span className="block text-xs text-ink-mute">{fmtDate(f.date)}{!f.hasExpenses && " · sin gastos ingresados"}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums">{clp(f.gross)}</td>
                      <td className="py-2 text-right tabular-nums">{clp(f.avgTicket)}</td>
                      <td className={`py-2 text-right font-medium tabular-nums ${f.profit < 0 ? "text-accent-deep" : "text-leaf"}`}>{clp(f.profit)}</td>
                      <td className="py-2 text-right tabular-nums">{f.missingCosts ? <span className="text-xs text-[#8a5a1c]">faltan costos</span> : pct(f.margin)}</td>
                      <td className="py-2 text-right tabular-nums">{f.perHour === null ? "—" : clp(f.perHour)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </Card>
      )}

      <div className="mt-6">
        <Legend items={[{ label: "Tienda online", color: SERIES_COLORS.online }, { label: "Feria", color: SERIES_COLORS.feria }]} />
      </div>
    </>
  );
}

function Tile({ label, value, now, before, hint }: { label: string; value: string; now: number; before: number; hint?: string }) {
  const delta = before ? (now - before) / Math.abs(before) : null;
  return (
    <div className="rounded-2xl border border-line bg-white/60 p-5">
      <p className="text-xs tracking-[0.14em] text-ink-mute uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
      <p className="mt-1 text-sm">
        {delta === null ? (
          <span className="text-ink-mute">Sin período anterior</span>
        ) : (
          <span className={delta >= 0 ? "text-leaf" : "text-accent-deep"}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))} % <span className="text-ink-mute">vs. período anterior</span>
          </span>
        )}
      </p>
      {hint && <p className="text-sm text-ink-soft">{hint}</p>}
    </div>
  );
}

function Funnel({ f }: { f: Report["funnel"] }) {
  const steps: [string, number][] = [
    ["Pedidos iniciados", f.created],
    ["Fueron a pagar", f.wentToPay],
    ["Pagaron", f.paid],
  ];
  const max = Math.max(1, f.created);
  return (
    <div>
      <ul className="space-y-3">
        {steps.map(([l, v]) => (
          <li key={l}>
            <div className="flex justify-between text-sm">
              <span className="text-ink-soft">{l}</span>
              <span className="tabular-nums">{v} <span className="text-xs text-ink-mute">({pct(v / max)})</span></span>
            </div>
            <div className="mt-1 h-3 rounded-r-[4px] bg-paper-2">
              <div className="h-3 rounded-r-[4px]" style={{ width: `${(v / max) * 100}%`, backgroundColor: SERIES_COLORS.online }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        <b className="tabular-nums">{f.abandoned}</b> <span className="text-ink-soft">abandonados (la reserva venció sin pago).</span>
      </p>
    </div>
  );
}

/** Conclusiones automáticas: lo que conviene mirar o hacer */
function Insights({ r }: { r: Report }) {
  const out: string[] = [];
  const top = r.products[0];
  if (top && r.current.gross > 0) out.push(`${top.name} es tu producto estrella: ${pct(top.revenue / r.current.gross)} de las ventas del período.`);
  const lowMargin = r.products.filter((p) => p.margin !== null && p.margin < 0.2);
  if (lowMargin.length) out.push(`Margen bajo (menos de 20 %) en ${lowMargin.map((p) => p.name).slice(0, 3).join(", ")}: revisa precio o costo.`);
  const totalGrind = r.grinds.reduce((s, g) => s + g.units, 0);
  const topGrind = [...r.grinds].sort((a, b) => b.units - a.units)[0];
  if (totalGrind > 0 && topGrind.units) out.push(`El ${pct(topGrind.units / totalGrind)} del café se pide en molienda ${grindLabel(topGrind.grind)?.toLowerCase()}: tenla lista antes de cada feria y despacho.`);
  if (r.funnel.created >= 3) {
    const rate = r.funnel.abandoned / r.funnel.created;
    if (rate >= 0.25) out.push(`${pct(rate)} de los pedidos online se abandonan antes de pagar: un correo de carrito abandonado podría recuperar parte.`);
  }
  const losing = r.fairs.filter((f) => f.profit < 0 && f.hasExpenses);
  if (losing.length) out.push(`${losing.map((f) => f.name).join(", ")} dejó pérdida: evalúa si conviene repetir o negociar el stand.`);
  if (r.fairs.length > 1 && r.fairs[0].profit > 0) out.push(`La feria más rentable fue ${r.fairs[0].name} (${clp(r.fairs[0].profit)} de utilidad).`);
  const bestDay = [...r.weekdays].sort((a, b) => b.online + b.feria - (a.online + a.feria))[0];
  if (bestDay && bestDay.online + bestDay.feria > 0) out.push(`El ${bestDay.day} es el día que más vendes: buen día para publicar en Instagram o lanzar promociones.`);
  if (r.customers.buyers >= 3 && r.customers.repeatRate !== null && r.customers.repeatRate < 0.2) out.push(`Solo ${pct(r.customers.repeatRate)} de los clientes online compró más de una vez: un recordatorio de recompra a los ~18 días ayudaría.`);
  if (!out.length) return null;
  return (
    <Card title="Qué dicen los datos" className="mt-6">
      <ul className="space-y-2 text-sm">
        {out.slice(0, 6).map((t) => (
          <li key={t} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
            {t}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Empty() {
  return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-mute">Sin ventas en este período.</p>;
}
