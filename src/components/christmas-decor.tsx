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

/** Fila de pinos con la punta nevada (algunos con estrella) */
function TreeRow({ count = 40, colors = ["#3d5944", "#387b4d"], className = "" }: { count?: number; colors?: [string, string]; className?: string }) {
  return (
    <div className={`flex items-end justify-center gap-3 ${className}`}>
      {Array.from({ length: count }, (_, i) => {
        const h = [34, 26, 30, 22, 38, 28][i % 6];
        return (
          <svg key={i} viewBox="0 0 20 30" style={{ height: h }} className="shrink-0">
            <path d="M10 0 L17 12 L13.5 12 L19 21 L14 21 L20 28 L0 28 L6 21 L1 21 L6.5 12 L3 12 Z" fill={i % 3 ? colors[0] : colors[1]} />
            <path d="M10 0 L13 5 L11 4.5 L10 6 L9 4.5 L7 5 Z" fill="#fff" opacity="0.9" />
            <rect x="8.8" y="28" width="2.4" height="2" fill="#5b4d44" />
            {i % 5 === 2 && <path d="M10 -0.5 l1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5 2.2-.3z" fill="#e9c46a" />}
          </svg>
        );
      })}
    </div>
  );
}

/** Pinos nevados sobre el pie de página */
export function FooterTrees() {
  if (!useSeason(false)) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-10 overflow-hidden">
      <TreeRow className="absolute inset-x-0 bottom-0 h-10" />
    </div>
  );
}

/**
 * Kaffito (la mascota, con gorro de Navidad) empujando un trineo con regalos y café de un lado
 * a otro. Va dentro de un contenedor con position relative; sin movimiento se queda quieto.
 */
export function KaffitoSled({ height = 72 }: { height?: number }) {
  const sled = Math.round(height * 0.86);
  return (
    <div className="absolute bottom-0 left-[12%] flex items-end motion-safe:animate-[kaffito-walk_46s_linear_infinite]" data-testid="kaffito">
      <div className="relative z-10 motion-safe:animate-[kaffito-bob_0.35s_ease-in-out_infinite]">
        <WalkingKaffito height={height} />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen decorativa chica, sin optimizar */}
      <img src="/brand/trineo-navidad.png" alt="" width={Math.round((sled * 700) / 490)} height={sled} style={{ height: sled, marginLeft: -height / 6 }} className="w-auto drop-shadow-sm" />
    </div>
  );
}

/**
 * Franja navideña arriba de la tienda: el aviso de la fecha límite de despacho y, debajo, una
 * escena nocturna con pinos sobre la nieve por donde pasa Kaffito con su trineo.
 * Se muestra desde el primer render (estamos en temporada al publicarla) para no mover la página.
 */
export function ChristmasBand({ text }: { text: string | null }) {
  if (!useSeason(true)) return null;
  return (
    <div
      data-testid="aviso-navidad"
      className="relative h-[108px] overflow-hidden text-white sm:h-[100px]"
      style={{
        background:
          "radial-gradient(1.5px 1.5px at 12% 30%, #fff8 50%, transparent 51%), radial-gradient(1.5px 1.5px at 33% 18%, #fff6 50%, transparent 51%), radial-gradient(2px 2px at 58% 26%, #fff7 50%, transparent 51%), radial-gradient(1.5px 1.5px at 79% 14%, #fff6 50%, transparent 51%), radial-gradient(1.5px 1.5px at 91% 34%, #fff7 50%, transparent 51%), linear-gradient(180deg, #1c4229 0%, #2b5f3c 100%)",
      }}
    >
      <p className="relative z-20 mx-auto max-w-3xl px-4 pt-2 text-center text-xs leading-snug font-medium sm:text-sm">{text ?? " "}</p>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[64px]">
        <TreeRow count={60} colors={["#4a8a5c", "#6aa57a"]} className="absolute inset-x-0 bottom-2 h-10 opacity-80" />
        <svg viewBox="0 0 1200 20" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-3 w-full">
          <path d="M0 8 Q100 0 200 7 T400 6 T600 8 T800 5 T1000 7 T1200 6 V20 H0 Z" fill="#f6f0e7" />
        </svg>
        <div className="absolute inset-x-0 bottom-1.5 h-full">
          <KaffitoSled height={56} />
        </div>
      </div>
    </div>
  );
}

/*
 * Kaffito de perfil por capas: el cuerpo y cada pata son la misma imagen recortada (clip-path),
 * y las patas se balancean desde la cadera en pares diagonales, como un trote.
 * Coordenadas en % de public/brand/kaffito-navidad-perfil.png (572 × 600).
 */
const LEGS = [
  { x: [7, 25], top: 82, phase: "a" },
  { x: [25, 46], top: 86, phase: "b" },
  { x: [46, 65], top: 86, phase: "a" },
  { x: [65, 82], top: 86, phase: "b" },
] as const;
const BODY_CLIP = "polygon(0 0, 100% 0, 100% 100%, 82% 100%, 82% 86%, 25% 86%, 25% 82%, 7% 82%, 7% 100%, 0 100%)";

function WalkingKaffito({ height }: { height: number }) {
  const img = "absolute inset-0 size-full";
  return (
    <div className="relative drop-shadow-sm" style={{ width: Math.round((height * 572) / 600), height }}>
      {LEGS.map((l) => (
        // eslint-disable-next-line @next/next/no-img-element -- imagen decorativa chica, sin optimizar
        <img
          key={l.x[0]}
          src="/brand/kaffito-navidad-perfil.png"
          alt=""
          className={`${img} ${l.phase === "a" ? "motion-safe:animate-[kaffito-leg-a_0.7s_ease-in-out_infinite]" : "motion-safe:animate-[kaffito-leg-b_0.7s_ease-in-out_infinite]"}`}
          style={{
            clipPath: `polygon(${l.x[0]}% ${l.top}%, ${l.x[1]}% ${l.top}%, ${l.x[1]}% 100%, ${l.x[0]}% 100%)`,
            transformOrigin: `${(l.x[0] + l.x[1]) / 2}% ${l.top}%`,
          }}
        />
      ))}
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen decorativa chica, sin optimizar */}
      <img src="/brand/kaffito-navidad-perfil.png" alt="" className={img} style={{ clipPath: BODY_CLIP }} />
    </div>
  );
}
