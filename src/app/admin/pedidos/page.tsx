import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { ORDER_STATUS, fmtDateTime } from "@/lib/format";
import { orderLabel } from "@/lib/orders";
import { Empty, PageHeader, StatusPill, Table } from "@/components/admin/ui";

export const metadata = { title: "Pedidos" };

const FILTERS = [
  ["", "Todos"],
  ["por_preparar", "Por preparar"],
  ["pendiente_pago", "Pendientes de pago"],
  ["enviados", "En camino / listos"],
  ["cerrados", "Entregados"],
  ["fallidos", "Expirados o cancelados"],
] as const;

const STATUS_GROUPS: Record<string, string[]> = {
  por_preparar: ["pagado", "en_preparacion"],
  pendiente_pago: ["pendiente_pago"],
  enviados: ["despachado", "listo_retiro"],
  cerrados: ["entregado"],
  fallidos: ["expirado", "rechazado", "cancelado"],
};

export default async function OrdersPage({ searchParams }: PageProps<"/admin/pedidos">) {
  await connection();
  const sp = await searchParams;
  const filter = typeof sp.estado === "string" ? sp.estado : "";
  const channel = sp.canal === "online" || sp.canal === "feria" ? sp.canal : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let query = createAdminClient()
    .from("orders")
    .select("id, number, channel, status, delivery, total_clp, created_at, customers (name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (STATUS_GROUPS[filter]) query = query.in("status", STATUS_GROUPS[filter]);
  if (channel) query = query.eq("channel", channel);
  if (/^\d+$/.test(q)) query = query.eq("number", Number(q));
  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);

  const filtered = q && !/^\d+$/.test(q)
    ? orders.filter((o) => {
        const c = o.customers as unknown as { name: string; email: string } | null;
        return `${c?.name} ${c?.email}`.toLowerCase().includes(q.toLowerCase());
      })
    : orders;

  const href = (params: Record<string, string>) => {
    const next = new URLSearchParams({ ...(filter && { estado: filter }), ...(channel && { canal: channel }), ...(q && { q }), ...params });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    return `/admin/pedidos${next.size ? `?${next}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Pedidos" description="Pedidos online y ventas de feria." />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={href({ estado: k })} className={`rounded-full border px-3 py-1.5 text-sm ${filter === k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {label}
          </Link>
        ))}
        <span className="mx-2 h-5 w-px bg-line" />
        {[["", "Todo canal"], ["online", "Online"], ["feria", "Feria"]].map(([k, label]) => (
          <Link key={k} href={href({ canal: k })} className={`rounded-full border px-3 py-1.5 text-sm ${channel === k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
            {label}
          </Link>
        ))}
        <form className="ml-auto" action="/admin/pedidos">
          {filter && <input type="hidden" name="estado" value={filter} />}
          {channel && <input type="hidden" name="canal" value={channel} />}
          <input name="q" defaultValue={q} placeholder="N° o cliente" className="h-9 w-44 rounded-full border border-line bg-white px-3 text-sm" />
        </form>
      </div>

      {filtered.length ? (
        <Table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Entrega</th>
              <th>Estado</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const c = o.customers as unknown as { name: string; email: string } | null;
              return (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/pedidos/${o.id}`} className="font-medium underline-offset-4 hover:underline">
                      {orderLabel(o.number)}
                    </Link>
                  </td>
                  <td className="text-ink-soft">{fmtDateTime(o.created_at)}</td>
                  <td>{o.channel === "feria" ? <span className="text-ink-mute">Venta en feria</span> : c?.name ?? "—"}</td>
                  <td className="text-ink-soft">{o.delivery === "despacho" ? "Despacho" : o.delivery === "retiro" ? "Retiro" : "Presencial"}</td>
                  <td><StatusPill status={o.status} /></td>
                  <td className="text-right tabular-nums">{clp(o.total_clp)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <Empty>No hay pedidos {filter ? `en "${FILTERS.find((f) => f[0] === filter)?.[1]}"` : ""}.</Empty>
      )}
      <p className="mt-3 text-xs text-ink-mute">Se muestran los últimos 200. Estados: {Object.values(ORDER_STATUS).map((s) => s.label).join(", ")}.</p>
    </>
  );
}
