"use client";

import { useSyncExternalStore } from "react";
import type { Grind } from "@/lib/catalog-types";

/*
 * Carrito guardado en el navegador (localStorage).
 * Los precios y el stock se vuelven a validar en el servidor al pagar;
 * aquí solo se recuerda lo que la persona eligió.
 */

export type CartLine = {
  key: string; // producto + molienda
  productId: string;
  slug: string;
  name: string;
  priceClp: number;
  grind: Grind | null;
  qty: number;
  maxQty: number | null;
};

type State = {
  lines: CartLine[];
  lastAdded: { line: CartLine; added: number; at: number } | null;
};

const STORAGE_KEY = "kaffa-cart-v1";
const EMPTY: State = { lines: [], lastAdded: null };

let state: State = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = { lines: JSON.parse(raw) as CartLine[], lastAdded: null };
  } catch {
    // Sin acceso a localStorage (modo privado, etc.): el carrito vive solo en memoria
  }
}

function set(next: State) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.lines));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    loaded = false;
    state = EMPTY;
    load();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  load();
  return state;
}

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

export function cartCount(lines: CartLine[]) {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function addToCart(item: Omit<CartLine, "key" | "qty">, qty: number) {
  load();
  const key = `${item.productId}:${item.grind ?? "-"}`;
  const existing = state.lines.find((l) => l.key === key);
  const cap = item.maxQty ?? Infinity;
  const newQty = Math.min((existing?.qty ?? 0) + qty, cap);
  const line: CartLine = { ...item, key, qty: newQty };
  const lines = existing
    ? state.lines.map((l) => (l.key === key ? line : l))
    : [...state.lines, line];
  set({ lines, lastAdded: { line, added: newQty - (existing?.qty ?? 0), at: Date.now() } });
}

export function dismissLastAdded() {
  set({ ...state, lastAdded: null });
}
