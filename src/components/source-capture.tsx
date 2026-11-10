"use client";

import { useEffect, useState } from "react";
import { captureSource, currentSource } from "@/lib/track";
import { WELCOME_SOURCE } from "@/lib/welcome";

const SEEN_KEY = "kaffa-bienvenida-vista";

/**
 * Guarda el canal de llegada (enlace etiquetado o sitio de origen) al entrar a la tienda.
 * A quien llega por el QR de la feria le muestra una vez el descuento de bienvenida.
 */
export function SourceCapture({ welcomePct }: { welcomePct: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    captureSource();
    try {
      if (welcomePct > 0 && currentSource() === WELCOME_SOURCE && !localStorage.getItem(SEEN_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única desde localStorage
        setShow(true);
      }
    } catch {}
  }, [welcomePct]);

  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };
  return (
    <div role="dialog" aria-label="Bienvenida" data-testid="bienvenida-banner" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-3xl bg-ink p-5 text-paper shadow-xl">
      <p className="font-display text-xl">¡Qué bueno verte de nuevo!</p>
      <p className="mt-1 text-sm text-paper/80">
        Por venir desde la feria, tienes <b className="text-paper">{welcomePct} % de descuento</b> en tu primera compra online. Se aplica solo al pagar.
      </p>
      <button type="button" onClick={close} className="mt-4 h-10 rounded-full bg-accent px-5 text-sm font-medium text-white hover:bg-accent-deep">
        Ver los cafés
      </button>
    </div>
  );
}
