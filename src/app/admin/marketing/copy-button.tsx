"use client";

import { useState } from "react";
import { btn } from "@/components/admin/ui";

/** Copia un texto al portapapeles (para pegar en Instagram) */
export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={btn.secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copia el texto:", text);
        }
      }}
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
