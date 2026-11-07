"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  clearCart,
  getCartLines,
  getCartOwner,
  isCartDirty,
  mergeCartLines,
  onCartChange,
  replaceLines,
  setCartDirty,
  setCartOwner,
} from "@/lib/cart-store";
import { saveCart, syncCart } from "@/app/(tienda)/cart-actions";

/**
 * Mantiene el carrito sincronizado con la cuenta del cliente (si tiene sesiÃ³n),
 * para verlo igual en el celular y en el computador. No dibuja nada.
 *
 * - Al abrir la tienda o volver a la pestaÃ±a: trae el carrito de la cuenta
 *   (salvo que haya cambios de este navegador sin guardar: esos se guardan primero).
 * - Al cambiar el carrito: lo marca como pendiente y lo guarda en la cuenta.
 * - Al navegar: guarda lo pendiente y detecta si se iniciÃ³ o cerrÃ³ sesiÃ³n.
 */
export function CartSync() {
  const pathname = usePathname();
  const customerId = useRef<string | null>(null);
  const lastSaved = useRef<string>("");
  const busy = useRef(false);
  const applyingRemote = useRef(false);

  function forgetAccount() {
    customerId.current = null;
    setCartDirty(false);
    if (getCartOwner()) {
      setCartOwner(null);
      clearCart(); // el carrito de la cuenta no queda a la vista tras cerrar sesiÃ³n
    }
  }

  async function pull() {
    if (busy.current) return;
    busy.current = true;
    try {
      const sent = JSON.stringify(getCartLines());
      const res = await syncCart(getCartLines(), getCartOwner(), isCartDirty());
      if (res.customerId) {
        customerId.current = res.customerId;
        setCartOwner(res.customerId);
        lastSaved.current = JSON.stringify(res.lines);
        const changedMeanwhile = JSON.stringify(getCartLines()) !== sent;
        applyingRemote.current = true;
        // Si la persona agregÃ³ algo mientras se consultaba la cuenta, no se pierde: se combina
        replaceLines(changedMeanwhile ? mergeCartLines(res.lines, getCartLines()) : res.lines);
        applyingRemote.current = false;
        if (changedMeanwhile) {
          setCartDirty(true);
          void push();
        } else {
          setCartDirty(false);
        }
      } else {
        forgetAccount();
      }
    } catch {
      // sin conexiÃ³n: se reintenta en la prÃ³xima navegaciÃ³n
    } finally {
      busy.current = false;
    }
  }

  async function push() {
    const lines = getCartLines();
    const json = JSON.stringify(lines);
    if (json === lastSaved.current) {
      setCartDirty(false);
      return true;
    }
    const ok = await saveCart(lines).catch(() => null);
    if (ok) {
      lastSaved.current = json;
      if (JSON.stringify(getCartLines()) === json) setCartDirty(false);
    }
    return ok;
  }

  // Al navegar: si ya hay cuenta, guarda lo pendiente (y detecta un cierre de sesiÃ³n);
  // si no, revisa si se acaba de iniciar sesiÃ³n
  useEffect(() => {
    if (customerId.current) {
      push().then((ok) => {
        if (ok === false) forgetAccount();
      });
    } else {
      void pull();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Al volver a la pestaÃ±a: trae cambios hechos en otro dispositivo
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !customerId.current) return;
      push().then(() => pull());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada cambio del carrito se marca como pendiente y se guarda en la cuenta
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onCartChange(() => {
      if (applyingRemote.current) return;
      // Se marca aunque aÃºn no se sepa si hay sesiÃ³n: al cargar la pÃ¡gina siguiente se guarda
      if (getCartOwner()) setCartDirty(true);
      if (!customerId.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => void push(), 600);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  return null;
}
