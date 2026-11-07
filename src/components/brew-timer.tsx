"use client";

import { useEffect, useRef, useState } from "react";

type Step = { title: string; text: string; seconds: number };

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/**
 * Pasos de la receta con temporizador de extracción. Los pasos con duración se
 * cronometran en orden: el paso en curso se resalta y, al cambiar de paso, suena un
 * aviso suave y vibra el celular. Mientras corre, la pantalla no se apaga.
 * Los pasos sin duración son de preparación previa.
 */
export function BrewSteps({ steps }: { steps: Step[] }) {
  const total = steps.reduce((s, x) => s + (x.seconds || 0), 0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const startedAt = useRef(0); // marca de tiempo equivalente al segundo 0
  const lastStep = useRef(-1);
  const wakeLock = useRef<WakeLockSentinel | null>(null);
  const audio = useRef<AudioContext | null>(null);

  // Tramos de tiempo de cada paso cronometrado
  let acc = 0;
  const ranges = steps.map((s) => {
    if (!s.seconds) return null;
    const range = { from: acc, to: acc + s.seconds };
    acc += s.seconds;
    return range;
  });
  const done = total > 0 && elapsed >= total;
  const current = running || elapsed > 0 ? ranges.findIndex((r) => r && elapsed >= r.from && elapsed < r.to) : -1;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const t = (Date.now() - startedAt.current) / 1000;
      if (t >= total) {
        setElapsed(total);
        setRunning(false);
      } else {
        setElapsed(t);
      }
    };
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [running, total]);

  // Aviso al cambiar de paso y al terminar
  useEffect(() => {
    const idx = done ? steps.length : current;
    if (!running && !done) return;
    if (idx === lastStep.current) return;
    if (lastStep.current !== -1) signal(done ? 3 : 1);
    lastStep.current = idx;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, done, running]);

  // Pantalla encendida mientras corre (si el navegador lo permite)
  useEffect(() => {
    if (!running) {
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
      return;
    }
    navigator.wakeLock?.request("screen").then((l) => (wakeLock.current = l)).catch(() => {});
    return () => {
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, [running]);

  function signal(beeps: number) {
    try {
      navigator.vibrate?.(beeps > 1 ? [180, 120, 180, 120, 180] : 180);
      const ctx = (audio.current ??= new AudioContext());
      for (let i = 0; i < beeps; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.3);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.3 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.3 + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i * 0.3);
        o.stop(ctx.currentTime + i * 0.3 + 0.25);
      }
    } catch {
      // sin audio disponible: basta con lo visual
    }
  }

  function start() {
    if (done) reset();
    // Crear el audio con el clic (los navegadores lo exigen)
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    } catch {}
    startedAt.current = Date.now() - (done ? 0 : elapsed) * 1000;
    if (lastStep.current === -1) lastStep.current = ranges.findIndex(Boolean);
    setRunning(true);
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    lastStep.current = -1;
  }

  const currentStep = current >= 0 ? steps[current] : null;
  const left = current >= 0 && ranges[current] ? ranges[current]!.to - elapsed : 0;

  return (
    <>
      <ol className="mt-6 space-y-2">
        {steps.map((s, i) => {
          const isCurrent = i === current && !done;
          const isPast = (ranges[i] && elapsed >= ranges[i]!.to) || (!s.seconds && (running || elapsed > 0));
          return (
            <li
              key={i}
              className={`flex gap-4 rounded-2xl p-2 transition-colors ${isCurrent ? "bg-crema/15 ring-1 ring-crema/50" : ""} ${isPast && !isCurrent ? "opacity-55" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs tabular-nums ${isCurrent ? "bg-crema text-ink" : "bg-ink text-paper"}`}
              >
                {isPast && !isCurrent ? "✓" : i + 1}
              </span>
              <p className="flex-1 text-sm leading-relaxed">
                {s.title && <span className="font-medium">{s.title}. </span>}
                <span className="text-ink-soft">{s.text}</span>
              </p>
              {s.seconds > 0 && <span className="shrink-0 text-xs text-ink-mute tabular-nums">{mmss(s.seconds)}</span>}
            </li>
          );
        })}
      </ol>

      {total > 0 && (
        <div className="mt-6 rounded-2xl bg-ink p-4 text-paper sm:p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-[0.16em] text-paper/60 uppercase">
                {done ? "¡Listo!" : running || elapsed > 0 ? "Temporizador" : "¿Sin balanza ni reloj?"}
              </p>
              <p className="mt-0.5 text-sm text-paper/85" aria-live="polite">
                {done
                  ? "Extracción terminada. Retira el filtro y disfruta."
                  : currentStep
                    ? `Ahora: ${currentStep.title || currentStep.text} · quedan ${mmss(Math.ceil(left))}`
                    : "Pulsa iniciar al comenzar a verter el agua. Te guiaremos paso a paso."}
              </p>
            </div>
            <p className="font-display text-4xl tabular-nums" aria-label={`Tiempo ${mmss(elapsed)} de ${mmss(total)}`}>
              {mmss(elapsed)}
              <span className="text-lg text-paper/50"> / {mmss(total)}</span>
            </p>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-paper/15">
            <div className="h-full rounded-full bg-crema transition-[width] duration-200" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
          </div>
          <div className="mt-4 flex gap-2">
            {running ? (
              <button type="button" onClick={() => setRunning(false)} className="h-11 rounded-full bg-paper px-6 text-sm font-medium text-ink">
                Pausar
              </button>
            ) : (
              <button type="button" onClick={start} className="h-11 rounded-full bg-crema px-6 text-sm font-medium text-ink">
                {done ? "Repetir" : elapsed > 0 ? "Continuar" : "Iniciar temporizador"}
              </button>
            )}
            {(elapsed > 0 || running) && !done && (
              <button type="button" onClick={reset} className="h-11 rounded-full border border-paper/30 px-5 text-sm">
                Reiniciar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
