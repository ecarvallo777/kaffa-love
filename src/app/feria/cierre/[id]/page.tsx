import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clp } from "@/lib/catalog-utils";
import { sessionSummary } from "@/lib/fair";

export default async function ClosedSessionPage({ params }: PageProps<"/feria/cierre/[id]">) {
  await connection();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: session } = await createAdminClient().from("fair_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) notFound();
  const s = await sessionSummary(id);
  const diff = session.point_total_clp !== null ? session.point_total_clp - s.total : null;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <p className="text-sm tracking-wide text-leaf uppercase">Jornada cerrada</p>
      <h1 className="mt-2 font-display text-4xl">{session.name}</h1>
      <p className="mt-6 font-display text-5xl tabular-nums">{clp(s.total)}</p>
      <p className="text-ink-soft">{s.count} ventas</p>
      {diff !== null && (
        <p className={`mt-4 rounded-xl px-3 py-2 text-sm ${diff === 0 ? "bg-leaf/15 text-leaf" : "bg-crema/20 text-[#8a5a1c]"}`}>
          Point: {clp(session.point_total_clp)} · {diff === 0 ? "cuadra" : `diferencia ${clp(diff)}`}
        </p>
      )}
      <Link href="/feria" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper">Volver al inicio</Link>
    </div>
  );
}
