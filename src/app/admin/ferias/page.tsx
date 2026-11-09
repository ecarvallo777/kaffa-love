import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { getFairProfits } from "@/lib/fair-profit";
import { Empty, LinkButton, PageHeader, Pill, Table } from "@/components/admin/ui";

export const metadata = { title: "Ferias" };

export default async function FairsAdminPage() {
  await connection();
  const { data: sessions } = await createAdminClient().from("fair_sessions").select("*").order("opened_at", { ascending: false }).limit(100);
  const profits = await getFairProfits((sessions ?? []).map((s) => s.id));

  const totalProfit = [...profits.values()].reduce((s, p) => s + p.profit.profit, 0);
  const withExpenses = [...profits.values()].filter((p) => p.expenses.length).length;

  return (
    <>
      <PageHeader
        title="Ferias"
        description="Jornadas de venta presencial: ventas, gastos y utilidad real de cada una. Entra a una jornada para ingresar sus gastos."
        actions={<LinkButton href="/feria" variant="primary">Abrir vista de feria</LinkButton>}
      />
      {sessions?.length ? (
        <>
          <Table>
            <thead>
              <tr>
                <th>Jornada</th>
                <th>Fecha</th>
                <th className="text-right">Ventas</th>
                <th className="text-right">Total</th>
                <th className="text-right">Gastos</th>
                <th className="text-right">Utilidad</th>
                <th>Cuadre Point</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const fp = profits.get(s.id)!;
                const p = fp.profit;
                const diff = s.point_total_clp !== null ? s.point_total_clp - p.gross : null;
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/ferias/${s.id}`} className="font-medium underline-offset-4 hover:underline">{s.name}</Link>
                      {s.location && <span className="block text-xs text-ink-mute">{s.location}</span>}
                    </td>
                    <td className="whitespace-nowrap text-ink-soft">
                      {fmtDateTime(s.opened_at)}
                      {!s.closed_at && <> · <Pill tone="wait">Abierta</Pill></>}
                    </td>
                    <td className="text-right tabular-nums">{p.orders}</td>
                    <td className="text-right tabular-nums">{clp(p.gross)}</td>
                    <td className="text-right tabular-nums">
                      {fp.expenses.length ? clp(p.expenses) : <Link href={`/admin/ferias/${s.id}`} className="text-xs text-accent-deep underline">Ingresar</Link>}
                    </td>
                    <td className={`text-right font-medium tabular-nums ${p.profit < 0 ? "text-accent-deep" : "text-leaf"}`}>
                      {clp(p.profit)}
                      {p.missingCost.length ? <span className="block text-xs font-normal text-[#8a5a1c]">faltan costos</span> : p.margin !== null && <span className="block text-xs font-normal text-ink-mute">{Math.round(p.margin * 100)} %</span>}
                    </td>
                    <td>
                      {diff === null ? "—" : diff === 0 ? <Pill tone="ok">Cuadra</Pill> : <Pill tone="wait">{clp(diff)}</Pill>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-3 text-sm text-ink-soft">
            Utilidad acumulada: <b className={`tabular-nums ${totalProfit < 0 ? "text-accent-deep" : "text-leaf"}`}>{clp(totalProfit)}</b>
            {withExpenses < sessions.length && (
              <span className="text-ink-mute"> · {sessions.length - withExpenses} jornada(s) sin gastos ingresados</span>
            )}
          </p>
        </>
      ) : (
        <Empty>Aún no hay jornadas de feria.</Empty>
      )}
      <p className="mt-4 text-sm"><Link href="/admin/pedidos?canal=feria" className="underline">Ver todas las ventas de feria →</Link></p>
    </>
  );
}
