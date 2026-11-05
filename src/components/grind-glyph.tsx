import type { Grind } from "@/lib/catalog-types";

/** Dibujo del tamaño de partícula de cada molienda */

// Puntos fijos (no aleatorios) para que el dibujo sea igual en servidor y cliente
const FINE = Array.from({ length: 64 }, (_, i) => ({
  x: 7 + (i % 8) * 4.9 + ((i * 7) % 5) * 0.5 - 1,
  y: 7 + Math.floor(i / 8) * 4.9 + ((i * 11) % 5) * 0.5 - 1,
  r: 0.85 + ((i * 13) % 4) * 0.12,
}));
const MEDIUM = Array.from({ length: 16 }, (_, i) => ({
  x: 9 + (i % 4) * 10 + ((i * 7) % 3),
  y: 10 + Math.floor(i / 4) * 9 + ((i * 5) % 3),
  r: 2.1 + ((i * 3) % 3) * 0.35,
}));
const COARSE = [
  { x: 14, y: 14, r: 5.2 },
  { x: 32, y: 12, r: 4.4 },
  { x: 24, y: 28, r: 5.6 },
  { x: 40, y: 30, r: 4.6 },
  { x: 11, y: 36, r: 4.2 },
  { x: 33, y: 42, r: 3.8 },
];

export function GrindGlyph({ grind, className = "" }: { grind: Grind; className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      {grind === "grano" && (
        <g transform="rotate(-28 24 24)">
          <ellipse cx="24" cy="24" rx="12" ry="16" fill="currentColor" />
          <path
            d="M24 9 Q18 18 24 24 Q30 30 24 39"
            fill="none"
            stroke="var(--color-paper)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      )}
      {grind === "fina" &&
        FINE.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" />)}
      {grind === "media" &&
        MEDIUM.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" />)}
      {grind === "gruesa" &&
        COARSE.map((d, i) => (
          <path
            key={i}
            d={`M${d.x - d.r} ${d.y} L${d.x - d.r * 0.3} ${d.y - d.r} L${d.x + d.r} ${d.y - d.r * 0.4} L${d.x + d.r * 0.6} ${d.y + d.r * 0.8} L${d.x - d.r * 0.5} ${d.y + d.r} Z`}
            fill="currentColor"
          />
        ))}
    </svg>
  );
}
