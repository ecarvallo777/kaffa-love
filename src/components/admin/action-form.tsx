"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitKeepingValues } from "@/lib/forms";

export type ActionResult = { ok?: string; error?: string } | null;

/** Mensaje de resultado: etiqueta verde si salió bien, roja si hubo un error */
export function ActionMessage({ state, className = "mt-3" }: { state: ActionResult; className?: string }) {
  if (state?.error)
    return (
      <p role="alert" className={`${className} rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent-deep`}>
        {state.error}
      </p>
    );
  if (state?.ok)
    return (
      <p role="status" className={`${className} rounded-xl bg-leaf/10 px-3 py-2 text-sm text-leaf`}>
        {state.ok}
      </p>
    );
  return null;
}

/**
 * Formulario que llama a una Server Action y muestra su resultado.
 * La acción recibe (estadoAnterior, FormData) y devuelve { ok } o { error }.
 */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  confirm,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) return e.preventDefault();
        submitKeepingValues(e, formAction);
      }}
    >
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      <ActionMessage state={state} />
    </form>
  );
}
