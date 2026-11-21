import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductCosts } from "@/lib/costs";
import { getSettings } from "@/lib/settings";
import { commissionFor, getPriceStudies, marginAt, MIN_MARGIN } from "@/lib/pricing";
import { clp } from "@/lib/catalog-utils";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Pill, PageHeader, btn } from "@/components/admin/ui";
import { PriceReferences } from "@/components/admin/price-references";
import { applyPriceAction, studyAllAction, studyNowAction } from "./actions";

export const metadata = { title: "Precios" };
// "Estudiar ahora" busca en tiendas chilenas: 1 a 2 minutos
export const maxDuration = 300;

const TYPE: Record<string, string> = { cafe: "Café", accesorio: "Accesorio", preparado: "Preparado" };
const pct = (m: number | null) => (m === null ? "—" : `${Math.round(m * 100)} %`);

export default async function PricesPage() {
  await connection();
  const db = createAdminClient();
  const [{ data: products }, costs, settings, studies] = await Promise.all([
    db.from("products").select("id, name, type, price_clp").eq("active", true).in("type", ["cafe", "accesorio", "preparado"]).order("type").order("name"),
    getProductCosts(),
    getSettings(),
    getPriceStudies(),
  ]);
  const rows = (products ?? []).map((p) => {
    const cost = costs[p.id] ?? null;
    const commission = commissionFor(p.type, settings);
    const study = studies[p.id];
    const suggested = study?.status === "listo" ? study.suggestedPriceClp ?? null : null;
    return {
      ...p,
      cost,
      study,
      suggested,
      margin: cost === null ? null : marginAt(p.price_clp, cost, settings.ivaPct, commission),
      suggestedMargin: cost === null || suggested === null ? null : marginAt(suggested, cost, settings.ivaPct, commission),
      // Diferencias menores a 3 % no valen un cambio de precio
      change: suggested !== null && Math.abs(suggested - p.price_clp) / p.price_clp >= 0.03 ? suggested - p.price_clp : 0,
    };
  });
  const pending = rows.filter((r) => r.study?.status === "pendiente").length;
  const toReview = rows.filter((r) => r.change !== 0 && !r.study?.appliedAt);

  return (
    <>
      <PageHeader
        title="Precios"
        description={`Precio sugerido según el costo y un estudio de mercado en tiendas chilenas, con IVA (${settings.ivaPct} %) y comisión de Mercado Pago. Margen = utilidad sobre la venta sin IVA, después de la comisión. Nunca bajo ${Math.round(MIN_MARGIN * 100)} %. El precio solo cambia si presionas «Aplicar».`}
        actions={
          <ActionForm action={studyAllAction} confirm="Se estudian todos los productos con costo, de a uno cada 5 minutos. Cada estudio cuesta unos US$ 0,20 a 0,40. ¿Seguir?">
            <button className={btn.secondary}>Estudiar todos</button>
          </ActionForm>
        }
      />
      <p className="mb-6 text-sm text-ink-soft">
        {toReview.length ? `${toReview.length} producto${toReview.length === 1 ? "" : "s"} con un precio sugerido distinto al actual.` : "Ningún precio por revisar."}
        {pending > 0 && ` ${pending} en cola para estudiar.`}
      </p>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.name} <span className="text-xs font-normal text-ink-mute">· {TYPE[r.type]}</span>
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  Costo {r.cost === null ? <Link href={`/admin/productos/${r.id}`} className="text-danger-deep underline">sin costo</Link> : clp(r.cost)} · Hoy {clp(r.price_clp)}{" "}
                  <span className={r.margin !== null && r.margin < MIN_MARGIN ? "text-danger-deep" : ""}>(margen {pct(r.margin)})</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.study?.status === "pendiente" && <Pill tone="wait">En cola</Pill>}
                {r.study?.status === "error" && <Pill tone="bad">Error</Pill>}
                {r.suggested !== null && (
                  <>
                    <span className="text-sm">
                      Sugerido <b className="tabular-nums">{clp(r.suggested)}</b> <span className="text-ink-mute">(margen {pct(r.suggestedMargin)})</span>
                    </span>
                    {r.change !== 0 && <Pill tone={r.change > 0 ? "ok" : "info"}>{r.change > 0 ? "Subir" : "Bajar"} {clp(Math.abs(r.change))}</Pill>}
                    {r.change === 0 && <Pill>Precio en línea con el mercado</Pill>}
                  </>
                )}
              </div>
            </div>

            {r.study?.status === "error" && <p className="mt-2 text-sm text-danger-deep">{r.study.error}</p>}

            {r.study?.status === "listo" && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-ink-soft hover:text-ink">
                  Mercado: {r.study.market ? `${clp(r.study.market.min)} a ${clp(r.study.market.max)} (mediana ${clp(r.study.market.median)})` : "sin referencias"} · {r.study.references?.length ?? 0} referencias · {fmtDateTime(r.study.studiedAt)}
                </summary>
                <p className="mt-2 text-sm text-ink-soft">{r.study.summary}</p>
                <PriceReferences references={r.study.references ?? []} />
                <p className="mt-2 text-xs text-ink-mute">
                  Precio mínimo (margen {Math.round(MIN_MARGIN * 100)} %): {clp(r.study.floorPriceClp ?? 0)} · costo al estudiar {clp(r.study.costClp ?? 0)}
                  {r.study.usage?.costUsd != null && ` · estudio US$ ${r.study.usage.costUsd.toFixed(2)}`}
                </p>
              </details>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {r.cost !== null && (
                <ActionForm action={studyNowAction}>
                  <input type="hidden" name="productId" value={r.id} />
                  <button className="text-sm text-accent underline-offset-4 hover:underline">{r.study ? "Volver a estudiar" : "Estudiar ahora"} (1 a 2 min)</button>
                </ActionForm>
              )}
              {r.suggested !== null && r.change !== 0 && (
                <ActionForm action={applyPriceAction} confirm={`¿Cambiar el precio de ${r.name} de ${clp(r.price_clp)} a ${clp(r.suggested)}?`} className="ml-auto flex items-center gap-2">
                  <input type="hidden" name="productId" value={r.id} />
                  <input type="hidden" name="price" value={r.suggested} />
                  <button className={btn.primary}>Aplicar {clp(r.suggested)}</button>
                </ActionForm>
              )}
              {r.study?.appliedAt && <span className="text-xs text-leaf">Aplicado el {fmtDateTime(r.study.appliedAt)}</span>}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
