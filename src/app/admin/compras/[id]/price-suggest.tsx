"use client";

import { useState } from "react";
import Link from "next/link";
import { suggestExistingProductPrice, suggestNewProductPrice } from "../actions";
import { PriceReferences } from "@/components/admin/price-references";
import type { PriceReference } from "@/lib/pricing";

type Result =
  | { ok: true; error?: undefined; suggestedPriceClp: number; floorPriceClp: number; summary: string; references: PriceReference[] }
  | { ok?: undefined; error: string };
type Target = { kind: "nuevo"; name: string; type: "cafe" | "accesorio" } | { kind: "existente"; productId: string };

/**
 * «Sugerir precio según el mercado» (manual): para un accesorio nuevo de la factura rellena el precio de venta;
 * para uno existente que nunca se analizó, guarda la sugerencia en Admin → Precios (con el costo de esta factura).
 */
export function PriceSuggest({ target, costClp, onPrice }: { target: Target; costClp: number; onPrice?: (p: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const ready = costClp > 0 && (target.kind === "existente" || target.name.trim().length > 0);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const r: Result =
        target.kind === "nuevo"
          ? await suggestNewProductPrice({ name: target.name, type: target.type, costClp })
          : await suggestExistingProductPrice({ productId: target.productId, costClp });
      setResult(r);
      if (r.ok) onPrice?.(r.suggestedPriceClp);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-4">
      <button type="button" onClick={run} disabled={busy || !ready} className="text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50">
        {busy
          ? "Buscando precios en tiendas chilenas… (1 a 2 minutos)"
          : target.kind === "nuevo"
            ? "Sugerir precio según el mercado"
            : "Este producto nunca se ha comparado con el mercado: sugerir precio"}
      </button>
      {result?.error && <p className="mt-2 text-sm text-danger-deep">{result.error}</p>}
      {result?.ok && (
        <div className="mt-2 rounded-xl border border-line bg-white p-3 text-sm">
          <p>
            Sugerido: <b>${result.suggestedPriceClp.toLocaleString("es-CL")}</b> (mínimo con 25 % de margen: ${result.floorPriceClp.toLocaleString("es-CL")})
            {target.kind === "existente" && (
              <>
                {" "}· Para cambiarlo, ve a{" "}
                <Link href="/admin/precios" className="text-accent underline">Precios</Link> después de aplicar la factura.
              </>
            )}
          </p>
          <p className="mt-1 text-ink-soft">{result.summary}</p>
          <PriceReferences references={result.references} />
        </div>
      )}
    </div>
  );
}
