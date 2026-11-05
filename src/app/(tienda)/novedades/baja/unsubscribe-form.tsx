"use client";

import { useActionState } from "react";
import { unsubscribe } from "./actions";

export function UnsubscribeForm() {
  const [done, action, pending] = useActionState(unsubscribe, null);
  if (done === "ok") return <p className="rounded-2xl bg-leaf/10 p-4 text-leaf">Listo. No te enviaremos más novedades.</p>;
  return (
    <form action={action} className="flex flex-wrap gap-3">
      <input name="email" type="email" required placeholder="tu@correo.cl" className="h-12 min-w-64 flex-1 rounded-full border border-line bg-paper px-5" />
      <button disabled={pending} className="h-12 rounded-full bg-ink px-6 font-medium text-paper disabled:opacity-60">Darme de baja</button>
      {done && done !== "ok" && <p className="w-full text-sm text-accent">{done}</p>}
    </form>
  );
}
