"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { captureSource, currentSource } from "@/lib/track";
import { isWelcomeSource } from "@/lib/welcome";
import { readConsent } from "@/lib/meta-events";

const SEEN_KEY = "kaffa-bienvenida-vista";

/**
 * Guarda el canal de llegada (enlace etiquetado o sitio de origen) al entrar a la tienda.
 * A quien llega por el QR de la feria o un anuncio de Meta le muestra una vez el descuento de
 * bienvenida. Si está el aviso de cookies, espera a que la persona lo responda (no se tapan).
 */
export function SourceCapture({ welcomePct }: { welcomePct: number }) {
  const [show, setShow] = useState<string | null>(null);
  useEffect(() => {
    captureSource();
    let source: string | null = null;
    try {
      source = currentSource();
      if (!(welcomePct > 0 && isWelcomeSource(source) && !localStorage.getItem(SEEN_KEY))) return;
    } catch {
      return;
    }
    const cookieBannerOpen = () => readConsent() === null && !!document.querySelector('[data-testid="aviso-cookies"]');
    const tryShow = () => {
      if (!cookieBannerOpen()) setShow(source);
    };
    // El aviso de cookies aparece después de cargar: se revisa un momento después y al responderlo
    const t = setTimeout(tryShow, 1200);
    window.addEventListener("kaffa-cookies", tryShow);
    return () => {
      clearTimeout(t);
      window.removeEventListener("kaffa-cookies", tryShow);
    };
  }, [welcomePct]);

  if (!show) return null;
  const close = () => {
    setShow(null);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };
  return (
    <div role="dialog" aria-label="Bienvenida" data-testid="bienvenida-banner" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-3xl bg-ink p-5 text-paper shadow-xl">
      <button type="button" onClick={close} aria-label="Cerrar" className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-paper/70 hover:bg-paper/10 hover:text-paper">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
      {show === "feria" ? (
        <>
          <p className="pr-8 font-display text-xl">¡Qué bueno verte de nuevo!</p>
          <p className="mt-1 text-sm text-paper/80">
            Por venir desde la feria, tienes <b className="text-paper">{welcomePct} % de descuento</b> en tu primera compra online. Se aplica solo al pagar.
          </p>
        </>
      ) : (
        <>
          <p className="pr-8 font-display text-xl">Te damos la bienvenida a Kaffa Love</p>
          <p className="mt-1 text-sm text-paper/80">
            En tu primera compra tienes <b className="text-paper">{welcomePct} % de descuento</b>. Se aplica solo al pagar.
          </p>
        </>
      )}
      <Link
        href="/categoria/cafe-de-especialidad"
        onClick={close}
        className="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-white hover:bg-accent-deep"
      >
        Ver los cafés
      </Link>
    </div>
  );
}
