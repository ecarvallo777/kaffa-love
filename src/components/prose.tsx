/** Contenedor para textos largos (legales, ayuda) */
export function Prose({ eyebrow, title, updated, children }: { eyebrow?: string; title: string; updated?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 pt-12 sm:px-6 sm:pt-16">
      {eyebrow && <p className="text-xs tracking-[0.2em] text-accent uppercase">{eyebrow}</p>}
      <h1 className="mt-3 font-display text-4xl font-light tracking-tight sm:text-5xl">{title}</h1>
      {updated && <p className="mt-3 text-sm text-ink-mute">Última actualización: {updated}</p>}
      <div className="mt-10 space-y-5 leading-relaxed text-ink-soft [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-medium [&_strong]:text-ink [&_ul]:space-y-2">
        {children}
      </div>
    </article>
  );
}
