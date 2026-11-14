import { startTransition } from "react";

/**
 * Envía un formulario a su Server Action sin que React lo limpie después.
 *
 * Con <form action={…}>, React vacía los campos al terminar la acción, aunque haya
 * devuelto un error: la persona pierde lo que había escrito. Úsalo así:
 *
 *   <form action={action} onSubmit={(e) => submitKeepingValues(e, action)}>
 *
 * Con la página cargada, onSubmit envía y conserva lo escrito. Mientras carga, el
 * navegador usa action={action} y el formulario funciona igual (sin perder envíos
 * ni mandar datos por la URL).
 */
export function submitKeepingValues(e: React.FormEvent<HTMLFormElement>, action: (form: FormData) => void) {
  e.preventDefault();
  const form = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
  startTransition(() => action(form));
}
