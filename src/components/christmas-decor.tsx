"use client";

import { useEffect, useState } from "react";
import { isChristmasSeason } from "@/lib/navidad";

/*
 * Decoración de Navidad: se activa sola según la fecha (ver src/lib/navidad.ts) y se calcula en
 * el navegador porque las páginas se prerenderizan. Sin movimiento si el visitante lo pidió.
 * Colores: verde del logo, rojo y crema de la tienda (el logo no se toca).
 */

export function useSeason(initial: boolean) {
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

/** Gorro navideño sobre el ícono del carrito */
export function SantaHat() {
  if (!useSeason(false)) return null;
  return (
    <svg aria-hidden viewBox="0 0 24 20" className="pointer-events-none absolute -top-2.5 -left-1.5 h-4 w-5 -rotate-12">
      <path d="M3 15 C5 6 11 1 17 4 C19 5 20 8 21 11 L14 10 C10 10 6 12 3 15 Z" fill="#b2402f" />
      <circle cx="21" cy="12" r="2.4" fill="#fff" />
      <rect x="1.5" y="13.5" width="15" height="4.5" rx="2.2" fill="#fff" transform="rotate(-12 9 16)" />
    </svg>
  );
}

/** Corona de pino con frutos rojos alrededor del café destacado de la portada (va detrás de la bolsa) */
export function HeroWreath() {
  if (!useSeason(false)) return null;
  const n = 56;
  const leaves = Array.from({ length: n }, (_, i) => (i * 360) / n);
  const greens = ["#387b4d", "#2b5f3c", "#3d5944", "#4a8a5c"];
  return (
    <svg aria-hidden viewBox="0 0 200 200" className="pointer-events-none absolute inset-0 size-full">
      {leaves.map((a, i) => (
        <g key={a} transform={`rotate(${a} 100 100)`}>
          <ellipse cx="100" cy={i % 2 ? 7 : 11} rx="8" ry="3" fill={greens[i % 4]} transform={`rotate(${i % 2 ? 32 : -32} 100 ${i % 2 ? 7 : 11})`} />
        </g>
      ))}
      {leaves.filter((_, i) => i % 7 === 3).map((a) => (
        <g key={`b${a}`} transform={`rotate(${a} 100 100)`}>
          <circle cx="97" cy="9" r="2.6" fill="#b2402f" />
          <circle cx="102" cy="11" r="2.4" fill="#c4473a" />
          <circle cx="99" cy="13" r="2.2" fill="#b2402f" />
        </g>
      ))}
      <g transform="translate(100 190)">
        <path d="M0 0 C-14 -12 -26 -4 -18 4 C-12 9 -4 4 0 0 Z M0 0 C14 -12 26 -4 18 4 C12 9 4 4 0 0 Z" fill="#b2402f" />
        <path d="M-2 2 L-9 12 M2 2 L9 12" stroke="#b2402f" strokeWidth="4" strokeLinecap="round" />
        <circle r="4" fill="#8c2e21" />
      </g>
    </svg>
  );
}

/** Cinta de regalo en la esquina de las tarjetas de packs */
export function GiftRibbon() {
  if (!useSeason(false)) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute top-0 right-0 size-28 overflow-hidden rounded-tr-2xl">
      <div className="absolute top-7 -right-10 w-44 rotate-45 bg-danger py-1 text-center text-[0.65rem] font-medium tracking-[0.14em] text-white uppercase shadow">
        Para regalar
      </div>
    </div>
  );
}

/** Fila de pinos nevados sobre el pie de página */
export function FooterTrees() {
  if (!useSeason(false)) return null;
  const trees = Array.from({ length: 40 }, (_, i) => i);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full flex h-10 items-end justify-center gap-3 overflow-hidden">
      {trees.map((i) => {
        const h = [34, 26, 30, 22, 38, 28][i % 6];
        return (
          <svg key={i} viewBox="0 0 20 30" style={{ height: h }} className="shrink-0">
            <path d="M10 0 L17 12 L13.5 12 L19 21 L14 21 L20 28 L0 28 L6 21 L1 21 L6.5 12 L3 12 Z" fill={i % 3 ? "#3d5944" : "#387b4d"} />
            <path d="M10 0 L13 5 L11 4.5 L10 6 L9 4.5 L7 5 Z" fill="#fff" opacity="0.9" />
            <rect x="8.8" y="28" width="2.4" height="2" fill="#5b4d44" />
            {i % 5 === 2 && <path d="M10 -0.5 l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#e9c46a" />}
          </svg>
        );
      })}
    </div>
  );
}
