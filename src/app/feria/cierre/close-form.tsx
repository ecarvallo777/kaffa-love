"use client";

import { useActionState, useState } from "react";
import { clp } from "@/lib/catalog-utils";
import { closeSessionAction } from "../actions";

export function CloseSessionForm({ sessionId, expected }: { sessionId: string; expected: number }) {
  const [error, action, pending] = useActionState(closeSessionAction, null);
  const [point, setPoint] = useState("");
  const pointNum = Number(point.replace(/[.$\s]/g, ""));
  const diff = point && Number.isFinite(pointNum) ? pointNum - expected : null;

  return (
    <form action={action} className="mt-8 space-y-4" onSubmit={(e) => { if (!confirm("¿Cerrar la jornada? Después no podrás registrar más ventas en ella.")) e.preventDefault(); }}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <label className="block">
        <span className="mb-1.5 block font-medium">Total del día según Mercado Pago Point</span>
        <input name="pointTotal" inputMode="numeric" value={point} onChange={(e) => setPoint(e.target.value)} placeholder="Ej.: 152500" className="h-14 w-full rounded-2xl border border-line bg-white px-4 text-lg" />
      </label>
      {diff !== null && (
        <p className={`rounded-xl px-3 py-2 text-sm font-medium ${diff === 0 ? "bg-leaf/15 text-leaf" : "bg-crema/20 text-[#8a5a1c]"}`}>
          {diff === 0 ? "Cuadra perfecto." : `Diferencia de ${clp(Math.abs(diff))} ${diff > 0 ? "a favor de Point" : "faltante en Point"}. Anota el motivo abajo.`}
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block font-medium">Notas (opcional)</span>
        <textarea name="notes" rows={3} className="w-full rounded-2xl border border-line bg-white px-4 py-3" />
      </label>
      {error && <p role="alert" className="text-accent-deep">{error}</p>}
      <button disabled={pending} className="h-14 w-full rounded-full bg-ink text-lg font-medium text-paper disabled:opacity-60">
        {pending ? "Cerrando…" : "Cerrar jornada"}
      </button>
    </form>
  );
}
