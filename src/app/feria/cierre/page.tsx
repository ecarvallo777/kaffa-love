import { connection } from "next/server";
import Link from "next/link";
import { clp } from "@/lib/catalog-utils";
import { getOpenSession, sessionSummary } from "@/lib/fair";
import { CloseSessionForm } from "./close-form";

export default async function ClosePage() {
  await connection();
  const session = await getOpenSession();
  if (!session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-display text-3xl">No hay una jornada abierta</p>
        <Link href="/feria" className="mt-6 inline-block underline">Volver</Link>
      </div>
    );
  }
  const s = await sessionSummary(session.id);
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href="/feria" className="text-sm text-ink-soft">← Seguir vendiendo</Link>
      <h1 className="mt-3 font-display text-4xl">Cerrar jornada</h1>
      <p className="text-ink-soft">{session.name}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-paper-2 p-4">
          <p className="text-sm text-ink-mute">Ventas</p>
          <p className="font-display text-3xl tabular-nums">{s.count}</p>
        </div>
        <div className="rounded-2xl bg-paper-2 p-4">
          <p className="text-sm text-ink-mute">Total registrado</p>
          <p className="font-display text-3xl tabular-nums">{clp(s.total)}</p>
        </div>
      </div>
      {s.products.length > 0 && (
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-white/60 text-sm">
          {s.products.map((p) => (
            <li key={p.name} className="flex justify-between gap-3 px-4 py-2">
              <span>{p.qty} × {p.name}</span>
              <span className="tabular-nums">{clp(p.total)}</span>
            </li>
          ))}
        </ul>
      )}
      <CloseSessionForm sessionId={session.id} expected={s.total} />
    </div>
  );
}
