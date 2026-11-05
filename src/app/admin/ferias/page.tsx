import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { PAID_STATUSES } from "@/lib/admin-data";
import { Empty, LinkButton, PageHeader, Pill, Table } from "@/components/admin/ui";

export const metadata = { title: "Ferias" };

export default async function FairsAdminPage() {
  await connection();
  const db = createAdminClient();
  const [{ data: sessions }, { data: orders }] = await Promise.all([
    db.from("fair_sessions").select("*").order("opened_at", { ascending: false }).limit(100),
    db.from("orders").select("fair_session_id, total_clp, status").eq("channel", "feria").in("status", PAID_STATUSES),
  ]);
  const totals = new Map<string, { count: number; total: number }>();
  for (const o of orders ?? []) {
    const t = totals.get(o.fair_session_id) ?? { count: 0, total: 0 };
    t.count++;
    t.total += o.total_clp;
    totals.set(o.fair_session_id, t);
  }

  return (
    <>
      <PageHeader title="Ferias" description="Jornadas de venta presencial y su cuadre con Mercado Pago Point." actions={<LinkButton href="/feria" variant="primary">Abrir vista de feria</LinkButton>} />
      {sessions?.length ? (
        <Table>
          <thead>
            <tr><th>Jornada</th><th>Apertura</th><th>Cierre</th><th className="text-right">Ventas</th><th className="text-right">Total app</th><th className="text-right">Total Point</th><th>Cuadre</th></tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const t = totals.get(s.id) ?? { count: 0, total: 0 };
              const diff = s.point_total_clp !== null ? s.point_total_clp - t.total : null;
              return (
                <tr key={s.id}>
                  <td>
                    <span className="font-medium">{s.name}</span>
                    {s.location && <span className="block text-xs text-ink-mute">{s.location}</span>}
                  </td>
                  <td className="text-ink-soft">{fmtDateTime(s.opened_at)}</td>
                  <td className="text-ink-soft">{s.closed_at ? fmtDateTime(s.closed_at) : <Pill tone="wait">Abierta</Pill>}</td>
                  <td className="text-right tabular-nums">{t.count}</td>
                  <td className="text-right tabular-nums">{clp(t.total)}</td>
                  <td className="text-right tabular-nums">{s.point_total_clp !== null ? clp(s.point_total_clp) : "—"}</td>
                  <td>
                    {diff === null ? "—" : diff === 0 ? <Pill tone="ok">Cuadra</Pill> : <Pill tone="wait">{clp(diff)}</Pill>}
                    {s.notes && <span className="block text-xs text-ink-mute">{s.notes}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Empty>Aún no hay jornadas de feria.</Empty>
      )}
      <p className="mt-4 text-sm"><Link href="/admin/pedidos?canal=feria" className="underline">Ver todas las ventas de feria →</Link></p>
    </>
  );
}
