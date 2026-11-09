import type { Metadata } from "next";
import { Suspense } from "react";
import { Prose } from "@/components/prose";
import { verifyUnsubscribe } from "@/lib/unsubscribe";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Dejar de recibir novedades", robots: { index: false } };

export default function UnsubscribePage(props: PageProps<"/novedades/baja">) {
  return (
    <Prose title="Dejar de recibir novedades">
      <p>No te enviaremos más novedades, recordatorios ni promociones. Seguirás recibiendo los correos de tus pedidos.</p>
      <Suspense fallback={<UnsubscribeForm email={null} />}>
        <FromLink searchParams={props.searchParams} />
      </Suspense>
    </Prose>
  );
}

/** Si viene desde el enlace de un correo (firmado), el correo ya va completo: baja de un clic */
async function FromLink({ searchParams }: Pick<PageProps<"/novedades/baja">, "searchParams">) {
  const sp = await searchParams;
  const e = typeof sp.e === "string" ? sp.e : "";
  const t = typeof sp.t === "string" ? sp.t : "";
  const valid = !!e && !!t && verifyUnsubscribe(e, t);
  return <UnsubscribeForm email={valid ? e : null} />;
}
