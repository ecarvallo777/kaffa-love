"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { metaEvent, readConsent, startPixel, writeConsent, type Consent } from "@/lib/meta-events";

/**
 * Aviso de cookies de publicidad y píxel de Meta. El píxel solo carga si la persona acepta.
 * Sin píxel configurado (o fuera de producción) no se muestra nada.
 */
export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent | "cargando">("cargando");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de la cookie
    setConsent(readConsent());
    const onChange = () => setConsent(readConsent());
    window.addEventListener("kaffa-cookies", onChange);
    return () => window.removeEventListener("kaffa-cookies", onChange);
  }, []);

  useEffect(() => {
    if (consent === "si") startPixel(pixelId);
  }, [consent, pixelId]);

  // Una vista de página por cada ruta (la tienda navega sin recargar)
  useEffect(() => {
    if (consent === "si") metaEvent("PageView");
  }, [consent, pathname]);

  if (consent !== null) return null;
  const choose = (v: "si" | "no") => {
    writeConsent(v);
    setConsent(v);
  };
  return (
    <div role="dialog" aria-label="Cookies" data-testid="aviso-cookies" className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border border-line bg-paper p-4 shadow-xl sm:inset-x-6 sm:bottom-6">
      <p className="text-sm text-ink-soft">
        Usamos cookies de Meta para mostrarte nuestros cafés en Instagram y Facebook y saber qué anuncios funcionan. ¿Nos dejas?{" "}
        <Link href="/legal/privacidad#cookies" className="underline underline-offset-4 hover:text-ink">Más información</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose("si")} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-accent">Aceptar</button>
        <button type="button" onClick={() => choose("no")} className="h-9 rounded-full border border-line px-4 text-sm hover:bg-paper-2">No, gracias</button>
      </div>
    </div>
  );
}

/** Botón para cambiar la elección (en la política de privacidad) */
export function CookieChoiceReset() {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        writeConsent(null);
        window.dispatchEvent(new Event("kaffa-cookies"));
        setDone(true);
      }}
      className="underline underline-offset-4"
    >
      {done ? "Listo: elige de nuevo en el aviso de abajo" : "Cambiar mi elección de cookies"}
    </button>
  );
}
