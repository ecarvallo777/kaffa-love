"use client";

import { useSyncExternalStore } from "react";
import type { Grind } from "@/lib/catalog-types";

/*
 * Molienda elegida en la ficha de un café, compartida entre el selector de
 * compra y las recetas (elegir "Gruesa" muestra la receta de prensa francesa,
 * y "Usar esta molienda" en una receta marca el selector). Nunca hay una
 * molienda preseleccionada: empieza vacía hasta que la persona elige.
 */

const selected = new Map<string, Grind>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSelectedGrind(productId: string, grind: Grind) {
  selected.set(productId, grind);
  listeners.forEach((l) => l());
}

export function useSelectedGrind(productId: string): Grind | null {
  return useSyncExternalStore(
    subscribe,
    () => selected.get(productId) ?? null,
    () => null,
  );
}

/** Lleva a la persona al selector de molienda de la ficha */
export function scrollToGrindSelector() {
  document.getElementById("molienda")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
