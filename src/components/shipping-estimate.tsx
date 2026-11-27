"use client";

import { useEffect, useState } from "react";
import { clp } from "@/lib/catalog-utils";
import { ratePrice, type ParcelSize } from "@/lib/shipping";
import type { ShippingRate } from "@/lib/settings";
import { christmasCutoff, fmtCutoff } from "@/lib/navidad";

/** Región elegida para calcular el envío; el checkout la usa si no hay datos guardados */
export const REGION_KEY = "kaffa-region-envio";

export function readEstimateRegion(): string {
  try {
    return localStorage.getItem(REGION_KEY) ?? "";
  } catch {
    return "";
  }
}

const short = (region: string) => (region === "Metropolitana de Santiago" ? "Santiago" : region.replace("Libertador General Bernardo O'Higgins", "O'Higgins").replace(" del General Carlos Ibáñez del Campo", "").replace(" y de la Antártica Chilena", ""));

/**
 * Cuánto cuesta el despacho antes del pago (la sorpresa del envío es la principal razón de
 * abandono). Muestra el mínimo y, al elegir la región, la tarifa y el plazo exactos.
 * Algunas comunas apartadas tienen su propia tarifa: el valor final se confirma en el pago.
 */
export function ShippingEstimate({
  rates,
  size,
  freeFromClp,
  subtotalClp = 0,
  className = "",
}: {
  rates: ShippingRate[];
  size: ParcelSize;
  freeFromClp: number | null;
  subtotalClp?: number;
  className?: string;
}) {
  const [region, setRegion] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única desde localStorage
    setRegion(readEstimateRegion());
  }, []);
  if (!rates.length) return null;

  const free = freeFromClp !== null && subtotalClp >= freeFromClp;
  const min = Math.min(...rates.map((r) => ratePrice(r, size)));
  const rate = rates.find((r) => r.region === region);
  const choose = (v: string) => {
    setRegion(v);
    try {
      if (v) localStorage.setItem(REGION_KEY, v);
      else localStorage.removeItem(REGION_KEY);
    } catch {}
  };

  return (
    <div className={className} data-testid="calculo-envio">
      <label className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
        <span className="text-ink-soft">Envío a</span>
        <select
          value={region}
          onChange={(e) => choose(e.target.value)}
          className="min-w-0 max-w-full rounded-full border border-line bg-paper px-3 py-1.5"
          aria-label="Región de despacho"
        >
          <option value="">elige tu región</option>
          {rates.map((r) => (
            <option key={r.region} value={r.region}>
              {short(r.region)}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-1.5 text-sm" aria-live="polite">
        {rate ? (
          free ? (
            <>
              <b className="font-medium text-leaf">Gratis</b> <span className="text-ink-soft">· llega en {rate.days}</span>
            </>
          ) : (
            <>
              <b className="font-medium tabular-nums">{clp(ratePrice(rate, size))}</b> <span className="text-ink-soft">· llega en {rate.days}</span>
            </>
          )
        ) : free ? (
          <b className="font-medium text-leaf">Despacho gratis a todo Chile</b>
        ) : (
          <span className="text-ink-soft">
            Desde <span className="tabular-nums">{clp(min)}</span>
          </span>
        )}
      </p>
      {rate && <ChristmasLine region={rate.region} />}
    </div>
  );
}

function ChristmasLine({ region }: { region: string }) {
  const cutoff = christmasCutoff(region);
  return cutoff ? <p className="mt-1 text-xs text-leaf">🎄 Llega antes de Navidad si compras hasta el {fmtCutoff(cutoff)}.</p> : null;
}
