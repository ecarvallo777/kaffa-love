"use client";

import { useEffect } from "react";
import { captureSource } from "@/lib/track";

/** Guarda el canal de llegada (enlace etiquetado o sitio de origen) al entrar a la tienda */
export function SourceCapture() {
  useEffect(() => {
    captureSource();
  }, []);
  return null;
}
