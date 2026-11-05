import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { clp } from "@/lib/catalog-utils";
import { simulatedPaymentsEnabled } from "@/lib/env";
import { logEvent } from "@/lib/events";
import { confirmOrderPaid, getOrder, orderLabel } from "@/lib/orders";

/**
 * Pasarela de PRUEBA para usar mientras no estén las credenciales de
 * Mercado Pago. No existe en producción.
 */
export default function SimulatedPaymentPage(props: PageProps<"/dev/pago-simulado/[id]">) {
  return (
    <Suspense>
      <Simulator {...props} />
    </Suspense>
  );
}

async function Simulator({ params }: PageProps<"/dev/pago-simulado/[id]">) {
  if (!simulatedPaymentsEnabled()) notFound();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  async function approve() {
    "use server";
    if (!simulatedPaymentsEnabled()) return;
    const o = await getOrder(id);
    if (!o) return;
    await confirmOrderPaid(o.id, `SIM-${o.id}`, o.total_clp);
    redirect(`/pedido/${o.id}`);
  }

  async function reject() {
    "use server";
    if (!simulatedPaymentsEnabled()) return;
    await logEvent("pago_rechazado", "order", id, { proveedor: "simulado" });
    redirect(`/pedido/${id}?sim=rechazado`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border-2 border-dashed border-crema bg-paper-2 p-8 text-center">
        <p className="text-xs tracking-[0.2em] text-crema uppercase">Modo de prueba</p>
        <h1 className="mt-3 font-display text-3xl">Pago simulado</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Aquí aparecerá Mercado Pago cuando configures MP_ACCESS_TOKEN.
        </p>
        <p className="mt-6 text-sm text-ink-mute">Pedido {orderLabel(order.number)}</p>
        <p className="font-display text-4xl tabular-nums">{clp(order.total_clp)}</p>
        <div className="mt-8 grid gap-3">
          <form action={approve}>
            <button className="h-12 w-full rounded-full bg-leaf font-medium text-paper">Aprobar pago</button>
          </form>
          <form action={reject}>
            <button className="h-12 w-full rounded-full border border-ink/20 font-medium">Rechazar pago</button>
          </form>
        </div>
      </div>
    </div>
  );
}
