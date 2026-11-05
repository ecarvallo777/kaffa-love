"use client";

import { useActionState } from "react";
import { openSessionAction } from "./actions";

export function OpenSessionForm({ preparados }: { preparados: { id: string; name: string; stock: number }[] }) {
  const [error, action, pending] = useActionState(openSessionAction, null);
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-display text-4xl">Abrir jornada</h1>
      <p className="mt-2 text-ink-soft">Cuando abras la jornada podrás registrar ventas. Al final la cierras para cuadrar con Point.</p>
      <form action={action} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-1.5 block font-medium">Nombre de la feria</span>
          <input name="name" required placeholder="Ej.: Feria Parque Bustamante" className="h-14 w-full rounded-2xl border border-line bg-white px-4 text-lg" />
        </label>
        <label className="block">
          <span className="mb-1.5 block font-medium">Lugar (opcional)</span>
          <input name="location" className="h-14 w-full rounded-2xl border border-line bg-white px-4 text-lg" />
        </label>
        {preparados.length > 0 && (
          <fieldset className="rounded-2xl border border-line bg-white/60 p-4">
            <legend className="px-1 font-medium">Preparados del día</legend>
            <p className="mb-3 text-sm text-ink-soft">¿Cuántas unidades traes? Las bebidas se venden sin control de stock.</p>
            {preparados.map((p) => (
              <label key={p.id} className="flex items-center justify-between gap-4 py-2">
                <span>{p.name}</span>
                <input name={`prep_${p.id}`} type="number" min={0} defaultValue={p.stock} inputMode="numeric" className="h-12 w-24 rounded-xl border border-line bg-white px-3 text-center text-lg" />
              </label>
            ))}
          </fieldset>
        )}
        {error && <p role="alert" className="text-accent-deep">{error}</p>}
        <button disabled={pending} className="h-14 w-full rounded-full bg-accent text-lg font-medium text-white disabled:opacity-60">
          {pending ? "Abriendo…" : "Abrir jornada"}
        </button>
      </form>
    </div>
  );
}
