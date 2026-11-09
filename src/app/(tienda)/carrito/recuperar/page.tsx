import type { Metadata } from "next";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Grind } from "@/lib/catalog-types";
import { RestoreCart } from "./restore-cart";

export const metadata: Metadata = { title: "Recuperar carrito", robots: { index: false } };

/**
 * Enlace de los correos de carrito abandonado y recompra: vuelve a armar el
 * carrito con los productos de un pedido y lleva al carrito (precios y stock
 * se actualizan allí).
 */
export default function RecoverPage(props: PageProps<"/carrito/recuperar">) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <Suspense fallback={<p className="text-ink-soft">Preparando tu carrito…</p>}>
        <Recover searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Recover({ searchParams }: Pick<PageProps<"/carrito/recuperar">, "searchParams">) {
  const sp = await searchParams;
  const orderId = typeof sp.pedido === "string" && /^[0-9a-f-]{36}$/i.test(sp.pedido) ? sp.pedido : null;
  const origen = sp.origen === "recompra" ? "recompra" : "abandono";
  if (!orderId) return <RestoreCart items={[]} origen={origen} />;

  const { data } = await createAdminClient()
    .from("order_items")
    .select("product_id, product_name, unit_price_clp, quantity, grind, orders!inner(channel)")
    .eq("order_id", orderId)
    .eq("orders.channel", "online");
  const items = (data ?? []).map((i) => ({
    productId: i.product_id as string,
    name: i.product_name as string,
    priceClp: i.unit_price_clp as number,
    qty: i.quantity as number,
    grind: (i.grind as Grind | null) ?? null,
  }));
  return <RestoreCart items={items} origen={origen} />;
}
