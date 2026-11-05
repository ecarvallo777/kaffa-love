import type { Metadata } from "next";
import { ResetRequestForm } from "../forms";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false } };

export default function ResetPage() {
  const emailEnabled = !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  return (
    <div className="mx-auto max-w-sm px-4 pt-12">
      <h1 className="font-display text-4xl font-light">Crear o recuperar contraseña</h1>
      <p className="mt-2 text-ink-soft">Te enviaremos un enlace al correo con el que compras.</p>
      <div className="mt-8">
        {emailEnabled ? <ResetRequestForm /> : <p className="rounded-2xl bg-paper-2 p-4 text-sm">Por ahora esta opción no está disponible. Escríbenos desde la página de contacto y te ayudamos.</p>}
      </div>
    </div>
  );
}
