"use client";

import { useEffect, useState } from "react";
import { isChristmasSeason } from "@/lib/navidad";

/*
 * Decoración de Navidad: se activa sola según la fecha (ver src/lib/navidad.ts) y se calcula en
 * el navegador porque las páginas se prerenderizan. Sin movimiento si el visitante lo pidió.
 * Colores: verde del logo, rojo y crema de la tienda (el logo no se toca).
 */

function useSeason(initial: boolean) {
  const [on, setOn] = useState(initial);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de la fecha del visitante
    setOn(isChristmasSeason());
  }, []);
  return on;
}

/** Solo en temporada (visible desde el primer render: estamos en temporada al publicarlo) */
export function ChristmasOnly({ children }: { children: React.ReactNode }) {
  return useSeason(true) ? <>{children}</> : null;
}

/** Solo fuera de temporada */
export function OutOfSeason({ children }: { children: React.ReactNode }) {
  return useSeason(true) ? null : <>{children}</>;
}

const BULBS = ["#b2402f", "#387b4d", "#c4873a", "#b2402f", "#387b4d", "#e9c46a"];

/** Guirnalda de luces colgando bajo el encabezado */
export function ChristmasGarland() {
  if (!useSeason(false)) return null;
  const tiles = Array.from({ length: 24 });
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full flex h-5 overflow-hidden" data-testid="guirnalda">
      {tiles.map((_, t) => (
        <svg key={t} viewBox="0 0 120 20" className="h-5 w-[120px] shrink-0">
          <path d="M0 2 Q30 12 60 2 T120 2" fill="none" stroke="#3d5944" strokeWidth="1.2" />
          {[15, 45, 75, 105].map((x, i) => {
            const color = BULBS[(t * 4 + i) % BULBS.length];
            const y = 8.5;
            return (
              <g key={x} className="motion-safe:animate-[twinkle_2.4s_ease-in-out_infinite]" style={{ animationDelay: `${((t * 4 + i) % 5) * 0.45}s` }}>
                <rect x={x - 1.5} y={y - 2.5} width="3" height="2.5" rx="0.6" fill="#3d5944" />
                <ellipse cx={x} cy={y + 3.5} rx="3" ry="4.2" fill={color} />
              </g>
            );
          })}
        </svg>
      ))}
    </div>
  );
}

/** Destellos dorados y verdes que caen despacio (portada) */
export function FallingSparkles() {
  if (!useSeason(false)) return null;
  const flakes = [
    [4, 0, 14, 10], [12, 6, 18, 8], [21, 2, 16, 12], [29, 9, 20, 9], [37, 4, 15, 11], [46, 11, 19, 8],
    [54, 1, 17, 12], [62, 7, 21, 9], [70, 3, 16, 10], [78, 10, 18, 8], [86, 5, 15, 12], [94, 8, 20, 9],
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {flakes.map(([left, delay, duration, size], i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="absolute top-0 animate-[fall_linear_infinite] opacity-70"
          style={{ left: `${left}%`, width: size, height: size, animationDuration: `${duration}s`, animationDelay: `-${delay}s`, color: i % 3 === 1 ? "#387b4d" : "#c4873a" }}
        >
          <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="currentColor" />
        </svg>
      ))}
    </div>
  );
}
