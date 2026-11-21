"use client";

import { useState } from "react";
import { suggestNewProductPrice } from "../actions";
import { PriceReferences } from "@/components/admin/price-references";

type Result = Awaited<ReturnType<typeof suggestNewProductPrice>>;

/** Botón «Sugerir precio» para un producto nuevo de la factura: estudia el mercado y rellena el precio */
export function PriceSuggest({ name, type, costClp, onPrice }: { name: string; type: "cafe" | "accesorio"; costClp: number; onPrice: (p: number) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const r = await suggestNewProductPrice({ name, type, costClp });
      setResult(r);
      if ("ok" in r) onPrice(r.suggestedPriceClp);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-4">
      <button type="button" onClick={run} disabled={busy || !(costClp > 0) || !name.trim()} className="text-sm font-medium text-accent underline-offset-4 hover:underline disabled:opacity-50">
        {busy ? "Buscando precios en tiendas chilenas… (1 a 2 minutos)" : "Sugerir precio según el mercado"}
      </button>
      {result && "error" in result && <p className="mt-2 text-sm text-danger-deep">{result.error}</p>}
      {result && "ok" in result && (
        <div className="mt-2 rounded-xl border border-line bg-white p-3 text-sm">
          <p>
            Sugerido: <b>${result.suggestedPriceClp.toLocaleString("es-CL")}</b> (mínimo con 25 % de margen: ${result.floorPriceClp.toLocaleString("es-CL")})
          </p>
          <p className="mt-1 text-ink-soft">{result.summary}</p>
          <PriceReferences references={result.references} />
        </div>
      )}
    </div>
  );
}
