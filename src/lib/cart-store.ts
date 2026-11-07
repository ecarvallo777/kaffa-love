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

export function setLineQty(key: string, qty: number) {
  load();
  set({
    ...state,
    lines: state.lines
      .map((l) => (l.key === key ? { ...l, qty: Math.max(0, Math.min(qty, l.maxQty ?? 50)) } : l))
      .filter((l) => l.qty > 0),
  });
}

export function setLineGrind(key: string, grind: Grind) {
  load();
  const line = state.lines.find((l) => l.key === key);
  if (!line) return;
  const newKey = `${line.productId}:${grind}`;
  const other = state.lines.find((l) => l.key === newKey);
  const lines = other
    ? state.lines
        .filter((l) => l.key !== key)
        .map((l) => (l.key === newKey ? { ...l, qty: l.qty + line.qty } : l))
    : state.lines.map((l) => (l.key === key ? { ...l, key: newKey, grind } : l));
  set({ ...state, lines });
}

export function removeLine(key: string) {
  load();
  set({ ...state, lines: state.lines.filter((l) => l.key !== key) });
}

export function clearCart() {
  load();
  set({ lines: [], lastAdded: null });
}

// Sincronización con la cuenta ------------------------------------------------------

const OWNER_KEY = "kaffa-cart-owner";

/** Cuenta a la que pertenece el carrito de este navegador (null = armado sin sesión) */
export function getCartOwner(): string | null {
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setCartOwner(customerId: string | null) {
  try {
    if (customerId) window.localStorage.setItem(OWNER_KEY, customerId);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {}
}

const DIRTY_KEY = "kaffa-cart-dirty";

/** Hay cambios en este navegador que todavía no se guardaron en la cuenta */
export function isCartDirty() {
  try {
    return window.localStorage.getItem(DIRTY_KEY) === "1";
  } catch {
    return false;
  }
}

export function setCartDirty(dirty: boolean) {
  try {
    if (dirty) window.localStorage.setItem(DIRTY_KEY, "1");
    else window.localStorage.removeItem(DIRTY_KEY);
  } catch {}
}

export function getCartLines() {
  load();
  return state.lines;
}

/** Une dos carritos: misma línea (producto + molienda) → la cantidad mayor */
export function mergeCartLines(a: CartLine[], b: CartLine[]) {
  const map = new Map<string, CartLine>();
  for (const l of [...a, ...b]) {
    const cur = map.get(l.key);
    map.set(l.key, cur ? { ...l, qty: Math.max(cur.qty, l.qty) } : l);
  }
  return [...map.values()];
}

/** Reemplaza el carrito con el guardado en la cuenta */
export function replaceLines(lines: CartLine[]) {
  load();
  if (JSON.stringify(lines) === JSON.stringify(state.lines)) return;
  set({ lines, lastAdded: null });
}

/** Avisa cada vez que cambia el carrito (para guardarlo en la cuenta) */
export function onCartChange(listener: () => void) {
  return subscribe(listener);
}

/** Ajusta precios, nombres y máximos con los datos actuales del catálogo */
export function syncLines(update: (line: CartLine) => CartLine | null) {
  load();
  const lines = state.lines.map(update).filter((l): l is CartLine => !!l && l.qty > 0);
  const changed = JSON.stringify(lines) !== JSON.stringify(state.lines);
  if (changed) set({ ...state, lines });
  return changed;
}
