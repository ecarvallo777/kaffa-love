import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAID_STATUSES } from "@/lib/admin-data";
import { clp } from "@/lib/catalog-utils";
import { fmtDate } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Field, PageHeader, Pill, Table, btn, field } from "@/components/admin/ui";
import { createCustomerAction } from "./actions";

export const metadata = { title: "Clientes" };

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default async function CustomersPage({ searchParams }: PageProps<"/admin/clientes">) {
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const db = createAdminClient();
  const [{ data: customers }, { data: orders }] = await Promise.all([
    db.from("customers").select("id, email, name, phone, auth_user_id, marketing_consent, source, created_at").order("created_at", { ascending: false }),
    db.from("orders").select("customer_id, status, total_clp, created_at").not("customer_id", "is", null),
  ]);
  const stats = new Map<string, { orders: number; total: number; last: string | null }>();
  for (const o of orders ?? []) {
    if (!PAID_STATUSES.includes(o.status)) continue;
    const s = stats.get(o.customer_id!) ?? { orders: 0, total: 0, last: null };
    s.orders++;
    s.total += o.total_clp;
    if (!s.last || o.created_at > s.last) s.last = o.created_at;
    stats.set(o.customer_id!, s);
  }
  const rows = (customers ?? [])
    .filter((c) => !c.email.endsWith("@kaffalove.test"))
    .filter((c) => !q || norm(`${c.name ?? ""} ${c.email} ${c.phone ?? ""}`).includes(norm(q)))
    .map((c) => ({ ...c, s: stats.get(c.id) ?? { orders: 0, total: 0, last: null } }));

  return (
    <>
      <PageHeader title="Clientes" description="Busca un cliente, ármale un carrito y envíaselo: con el botón del correo entra directo a pagar." />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <form className="flex flex-1 items-end gap-2">
          <Field label="Buscar" className="min-w-56 flex-1">
            <input name="q" defaultValue={q} placeholder="Nombre, correo o teléfono" className={field} />
          </Field>
          <button className={btn.secondary}>Buscar</button>
        </form>
        <details className="rounded-2xl border border-line bg-white/60 p-4">
          <summary className="cursor-pointer text-sm font-medium">＋ Nuevo cliente</summary>
          <ActionForm action={createCustomerAction} className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="Nombre">
              <input name="name" className={field} />
            </Field>
            <Field label="Correo">
              <input name="email" type="email" required className={field} />
            </Field>
            <Field label="Teléfono">
              <input name="phone" className={field} placeholder="+56 9…" />
            </Field>
            <button className={`${btn.primary} sm:col-span-3`}>Crear cliente</button>
          </ActionForm>
        </details>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Teléfono</th>
            <th className="text-right">Compras</th>
            <th className="text-right">Total</th>
            <th>Última compra</th>
            <th>Cuenta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>
                <Link href={`/admin/clientes/${c.id}`} className="font-medium underline-offset-4 hover:underline">{c.name || c.email}</Link>
                {c.name && <span className="block text-xs text-ink-mute">{c.email}</span>}
              </td>
              <td className="text-ink-soft">{c.phone ?? "—"}</td>
              <td className="text-right tabular-nums">{c.s.orders}</td>
              <td className="text-right tabular-nums">{c.s.total ? clp(c.s.total) : "—"}</td>
              <td className="text-ink-soft">{c.s.last ? fmtDate(c.s.last) : "—"}</td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {c.auth_user_id ? <Pill tone="ok">Con cuenta</Pill> : <Pill>Sin cuenta</Pill>}
                  {c.marketing_consent && <Pill tone="info">Novedades</Pill>}
                  {c.source === "prestashop" && <Pill>Tienda anterior</Pill>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-2 text-xs text-ink-mute">{rows.length} clientes{q && ` que coinciden con «${q}»`}. Compras y total: pedidos pagados (tienda y feria con correo).</p>
    </>
  );
}
