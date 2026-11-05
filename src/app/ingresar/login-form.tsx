"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next, initialError }: { next: string; initialError: string | null }) {
  const [error, action, pending] = useActionState(signIn, initialError);
  return (
    <form action={action} className="mt-8 w-full space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Correo</span>
        <input name="email" type="email" autoComplete="username" required className="h-12 w-full rounded-xl border border-line bg-paper px-4 outline-none focus:border-ink" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required className="h-12 w-full rounded-xl border border-line bg-paper px-4 outline-none focus:border-ink" />
      </label>
      {error && (
        <p role="alert" className="text-sm text-accent">
          {error}
        </p>
      )}
      <button disabled={pending} className="h-12 w-full rounded-full bg-ink font-medium text-paper hover:bg-accent disabled:opacity-60">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
