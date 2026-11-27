"use client";

import { useEffect, useState } from "react";
import { christmasMessage } from "@/lib/navidad";

/** Aviso de la fecha límite de Navidad: se calcula en el navegador (las páginas se prerenderizan) */
export function ChristmasBar() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de la fecha del visitante
    setText(christmasMessage());
  }, []);
  if (!text) return null;
  return (
    <div data-testid="aviso-navidad" className="bg-accent px-4 py-2 text-center text-sm text-white">
      🎄 {text}
    </div>
  );
}
