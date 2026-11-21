import { connection } from "next/server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCustomer } from "@/lib/customer-auth";
import { clp } from "@/lib/catalog-utils";
import { fmtDate, ORDER_STATUS } from "@/lib/format";
import { orderLabel } from "@/lib/orders";
import type { Grind } from "@/lib/catalog-types";
import { ConsentToggle, SignInForm } from "./forms";
import { customerSignOut } from "./actions";
import { ReorderButton } from "./reorder-button";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false } };

const ACCESS_MSG: Record<string, string> = {
  vencido: "El enlace del correo venció (dura 7 días). Ingresa con tu correo y contraseña; si no tienes, créala con «Olvidé mi contraseña». Tu carrito te espera.",
  invalido: "El enlace no es válido. Ingresa con tu correo y contraseña, o créala con «Olvidé mi contraseña».",
  error: "No pudimos ingresar con el enlace. Intenta de nuevo o ingresa con tu correo y contraseña.",
};

export default function AccountPage(props: PageProps<"/cuenta">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-paper-2" />}>
        <Account searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Account({ searchParams }: Pick<PageProps<"/cuenta">, "searchParams">) {
  await connection(); // la sesión se lee en cada visita
  const sp = await searchParams;
  const customer = await getCustomer();
  if (customer && sp.next === "/checkout") redirect("/checkout");
  if (!customer) {
    const access = typeof sp.acceso === "string" ? ACCESS_MSG[sp.acceso] : null;
    return (
      <div className="mx-auto max-w-sm">
        {access && <p role="alert" className="mb-6 rounded-2xl bg-crema/15 p-4 text-sm text-[#8a5a1c]">{access}</p>}
        <h1 className="font-display text-4xl font-light">Mi cuenta</h1>
        <p className="mt-2 text-ink-soft">Ingresa para ver tus pedidos. Si nunca creaste una contraseña, puedes hacerlo con “Olvidé mi contraseña”.</p>
        <div className="mt-8"><SignInForm /></div>
      </div>
    );
  }

  const { data: orders } = await createAdminClient()
    .from("orders")
    .select("id, number, status, total_clp, created_at, order_items (product_id, product_name, unit_price_clp, quantity, grind)")
    .eq("customer_id", customer.id)
    .eq("channel", "online")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-light">Hola{customer.name ? `, ${customer.name.split(" ")[0]}` : ""}</h1>
          <p className="text-ink-soft">{customer.email}</p>
        </div>
        <form action={customerSignOut}><button className="text-sm text-ink-soft underline underline-offset-4">Cerrar sesión</button></form>
      </div>

      <h2 className="mt-10 text-xs tracking-[0.16em] text-ink-mute uppercase">Tus pedidos</h2>
      {orders?.length ? (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {orders.map((o) => {
            const items = o.order_items as { product_id: string; product_name: string; unit_price_clp: number; quantity: number; grind: Grind | null }[];
            return (
              <li key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4">
                <Link href={`/pedido/${o.id}`} className="min-w-0 flex-1">
                  <span className="font-medium">{orderLabel(o.number)}</span>
                  <span className="text-ink-mute"> · {fmtDate(o.created_at)} · {ORDER_STATUS[o.status]?.label}</span>
                  <span className="block truncate text-sm text-ink-soft">{items.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")}</span>
                </Link>
                <span className="tabular-nums">{clp(o.total_clp)}</span>
                <ReorderButton items={items.map((i) => ({ productId: i.product_id, name: i.product_name, priceClp: i.unit_price_clp, qty: i.quantity, grind: i.grind }))} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-ink-soft">Aún no tienes pedidos.</p>
      )}

      <div className="mt-10 rounded-2xl bg-paper-2 p-5">
        <ConsentToggle consent={customer.marketing_consent} />
      </div>
    </>
  );
}
