import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { EVENT_LABELS, daysAgoIso, fmtDateTime, startOfTodayChile } from "@/lib/format";
import { ATTENTION_EVENTS } from "@/lib/events";
import { expirePendingOrders, orderLabel } from "@/lib/orders";
import { reconcilePendingPayments } from "@/lib/payments";
import { lowStock, salesSince } from "@/lib/admin-data";
import { mercadoPagoConfigured, siteUrl } from "@/lib/env";
import { getPickupLocations } from "@/lib/pickup";
import { Card, Empty, PageHeader, Pill, Stat, StatusPill } from "@/components/admin/ui";

export default async function AdminHome() {
  await connection();
  await reconcilePendingPayments();
  await expirePendingOrders();
  const db = createAdminClient();
  const today = startOfTodayChile();
  const week = daysAgoIso(7);
  const month = daysAgoIso(30);

  const [salesToday, salesWeek, toPrepare, alerts, low, recent, settingsFile, pickups] = await Promise.all([
    salesSince(today),
    salesSince(week),
    db.from("orders").select("id", { count: "exact", head: true }).eq("channel", "online").in("status", ["pagado", "en_preparacion"]),
    db.from("events").select("id, type, entity_id, data, created_at").in("type", [...ATTENTION_EVENTS]).gte("created_at", month).order("created_at", { ascending: false }).limit(10),
    lowStock(),
    db.from("orders").select("id, number, channel, status, total_clp, created_at, customers (name)").order("created_at", { ascending: false }).limit(8),
    db.storage.from("config").list("", { search: "settings.json" }),
    getPickupLocations(),
  ]);

  const setup = [
    { ok: mercadoPagoConfigured(), label: "Credenciales de Mercado Pago (MP_ACCESS_TOKEN)", href: null },
    { ok: !!process.env.MP_WEBHOOK_SECRET, label: "Clave de notificaciones de Mercado Pago (MP_WEBHOOK_SECRET)", href: null },
    { ok: siteUrl().startsWith("https://"), label: "Dominio público https (NEXT_PUBLIC_SITE_URL)", href: null },
    { ok: pickups.length > 0 && !pickups.some((p) => /por definir/i.test(p.address + p.hours)), label: "Lugar y horario de retiro definidos", href: "/admin/retiro" },
    { ok: !!settingsFile.data?.some((f) => f.name === "settings.json"), label: "Tarifas de despacho revisadas y guardadas", href: "/admin/configuracion" },
    { ok: !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM, label: "Correos de confirmación (RESEND_API_KEY y EMAIL_FROM)", href: null },
    { ok: !!process.env.CRON_SECRET, label: "Tarea programada para liberar reservas (CRON_SECRET)", href: null },
  ];
  const pendingSetup = setup.filter((s) => !s.ok);

  return (
    <>
      <PageHeader title="Resumen" description="Cómo va el negocio hoy y qué necesita tu atención." />

      {pendingSetup.length > 0 && (
        <Card title="Antes de vender" className="mb-6 border-crema/50 bg-crema/10">
          <ul className="space-y-2 text-sm">
            {setup.map((s) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs ${s.ok ? "bg-leaf text-paper" : "border border-ink-mute"}`}>{s.ok ? "✓" : ""}</span>
                {s.href && !s.ok ? (
                  <Link href={s.href} className="underline underline-offset-4">{s.label}</Link>
                ) : (
                  <span className={s.ok ? "text-ink-mute line-through" : ""}>{s.label}</span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-mute">Las variables se configuran en el proyecto de Vercel. Ver docs/PRODUCCION.md.</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ventas de hoy" value={clp(salesToday.total)} hint={`${salesToday.online.count} online · ${salesToday.feria.count} en feria`} />
        <Stat label="Últimos 7 días" value={clp(salesWeek.total)} hint={`Online ${clp(salesWeek.online.total)} · Feria ${clp(salesWeek.feria.total)}`} />
        <Stat label="Por preparar" value={toPrepare.count ?? 0} hint="Pedidos online pagados" />
        <Stat label="Stock bajo" value={low.length} hint={low.length ? low.slice(0, 2).map((p) => p.name).join(", ") : "Todo en orden"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Últimos pedidos" actions={<Link href="/admin/pedidos" className="text-sm text-ink-soft hover:text-ink">Ver todos →</Link>}>
          {recent.data?.length ? (
            <ul className="divide-y divide-line">
              {recent.data.map((o) => (
                <li key={o.id}>
                  <Link href={`/admin/pedidos/${o.id}`} className="flex items-center gap-3 py-2.5 text-sm hover:bg-paper-2/60">
                    <span className="w-16 font-medium tabular-nums">{orderLabel(o.number)}</span>
                    <span className="hidden w-14 text-ink-mute sm:block">{o.channel === "feria" ? "Feria" : "Online"}</span>
                    <span className="min-w-0 flex-1 truncate">{(o.customers as unknown as { name: string } | null)?.name ?? "—"}</span>
                    <StatusPill status={o.status} />
                    <span className="w-20 text-right tabular-nums">{clp(o.total_clp)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Aún no hay pedidos.</Empty>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Requiere atención">
            {alerts.data?.length ? (
              <ul className="space-y-3 text-sm">
                {alerts.data.map((e) => (
                  <li key={e.id}>
                    <Link href={`/admin/pedidos/${e.entity_id}`} className="block rounded-xl bg-accent/8 p-3 hover:bg-accent/12">
                      <Pill tone="bad">{EVENT_LABELS[e.type] ?? e.type}</Pill>
                      <p className="mt-1 text-xs text-ink-mute">{fmtDateTime(e.created_at)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Nada pendiente en los últimos 30 días.</p>
            )}
          </Card>
          <Card title="Stock bajo" actions={<Link href="/admin/stock" className="text-sm text-ink-soft hover:text-ink">Ajustar →</Link>}>
            {low.length ? (
              <ul className="space-y-2 text-sm">
                {low.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="truncate">{p.name}</span>
                    <Pill tone={p.stock === 0 ? "bad" : "wait"}>{p.stock === 0 ? "Agotado" : `${p.stock} u.`}</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Todos los productos tienen stock suficiente.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
