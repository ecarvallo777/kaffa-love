"use client";

import Link from "next/link";
import { useActionState, useTransition } from "react";
import { createAccountFromOrder, customerSignIn, requestPasswordReset, setMarketingConsent, setNewPassword } from "./actions";

const input = "h-12 w-full rounded-xl border border-line bg-paper px-4 outline-none focus:border-ink";
const primary = "h-12 w-full rounded-full bg-ink font-medium text-paper hover:bg-accent disabled:opacity-60";

export function SignInForm() {
  const [error, action, pending] = useActionState(customerSignIn, null);
  return (
    <form action={action} className="space-y-4">
      <input name="email" type="email" required autoComplete="email" placeholder="Correo" className={input} />
      <input name="password" type="password" required autoComplete="current-password" placeholder="Contraseña" className={input} />
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <button disabled={pending} className={primary}>{pending ? "Ingresando…" : "Ingresar"}</button>
      <p className="text-center text-sm"><Link href="/cuenta/recuperar" className="text-ink-soft underline underline-offset-4">Olvidé mi contraseña</Link></p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  if (state === "ok") return <p className="rounded-2xl bg-leaf/10 p-4 text-leaf">Si el correo tiene compras en la tienda, te enviamos un enlace para crear una nueva contraseña.</p>;
  return (
    <form action={action} className="space-y-4">
      <input name="email" type="email" required autoComplete="email" placeholder="Correo" className={input} />
      {state && <p role="alert" className="text-sm text-accent">{state}</p>}
      <button disabled={pending} className={primary}>{pending ? "Enviando…" : "Enviar enlace"}</button>
    </form>
  );
}

export function NewPasswordForm({ tokenHash }: { tokenHash: string }) {
  const [error, action, pending] = useActionState(setNewPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token_hash" value={tokenHash} />
      <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Nueva contraseña (mín. 8 caracteres)" className={input} />
      {error && <p role="alert" className="text-sm text-accent">{error}</p>}
      <button disabled={pending} className={primary}>{pending ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  );
}

export function CreateAccountOffer({ orderId, email }: { orderId: string; email: string }) {
  const [error, action, pending] = useActionState(createAccountFromOrder, null);
  return (
    <section className="mt-10 rounded-3xl border border-line p-6">
      <h2 className="font-display text-2xl">¿Quieres comprar más rápido la próxima vez?</h2>
      <p className="mt-1 text-sm text-ink-soft">Crea una contraseña para {email} y podrás ver tus pedidos y repetir tu café favorito con un clic.</p>
      <form action={action} className="mt-4 flex flex-wrap gap-3">
        <input type="hidden" name="orderId" value={orderId} />
        <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Contraseña (mín. 8 caracteres)" className={`${input} min-w-56 flex-1`} />
        <button disabled={pending} className="h-12 rounded-full bg-ink px-6 font-medium text-paper hover:bg-accent disabled:opacity-60">{pending ? "Creando…" : "Crear cuenta"}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-accent">{error}</p>}
    </section>
  );
}

export function ConsentToggle({ consent }: { consent: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" defaultChecked={consent} disabled={pending} onChange={(e) => start(() => setMarketingConsent(e.target.checked))} className="mt-0.5 size-4 accent-accent" />
      <span>Quiero recibir novedades: nuevos cafés, recetas y promociones.</span>
    </label>
  );
}
