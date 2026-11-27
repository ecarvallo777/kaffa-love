"use client";

import { useEffect, useState } from "react";
import { christmasMessage } from "@/lib/navidad";
import { ChristmasBand } from "@/components/christmas-decor";

/** Franja de Navidad con la fecha límite: el texto se calcula en el navegador (las páginas se prerenderizan) */
export function ChristmasBar() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de la fecha del visitante
    setText(christmasMessage());
  }, []);
  return <ChristmasBand text={text} />;
}
