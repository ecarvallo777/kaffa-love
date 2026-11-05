import type { Metadata } from "next";
import { Prose } from "@/components/prose";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Dejar de recibir novedades", robots: { index: false } };

export default function UnsubscribePage() {
  return (
    <Prose title="Dejar de recibir novedades">
      <p>Ingresa tu correo y no te enviaremos más novedades ni promociones. Seguirás recibiendo los correos de tus pedidos.</p>
      <UnsubscribeForm />
    </Prose>
  );
}
