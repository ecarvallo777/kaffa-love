import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Guías para preparar café en casa",
  description: "Recetas, moliendas y métodos explicados paso a paso por los tostadores de Kaffa Love: V60, prensa francesa, Chemex, moka y más.",
  alternates: { canonical: "/guias" },
};

export default async function GuidesPage() {
  const guides = await getPublishedGuides();
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 sm:pt-16">
      <p className="text-xs tracking-[0.2em] text-accent uppercase">Guías</p>
      <h1 className="mt-3 font-display text-4xl leading-[1.05] font-light tracking-tight sm:text-6xl">
        Café de especialidad <span className="italic">en casa</span>
      </h1>
      <p className="mt-4 text-lg text-ink-soft">Métodos, medidas y moliendas explicados paso a paso por quienes tostamos tu café.</p>
      {guides.length ? (
        <ul className="mt-10 divide-y divide-line border-y border-line">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link href={`/guias/${g.slug}`} className="group block py-6">
                <h2 className="font-display text-2xl font-light group-hover:text-accent">{g.title}</h2>
                <p className="mt-1 text-ink-soft">{g.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-ink-soft">
          Pronto publicaremos nuestras primeras guías. Mientras tanto, cada café trae su receta en la ficha:{" "}
          <Link href="/categoria/cafe-de-especialidad" className="text-accent underline underline-offset-4">ver cafés</Link>.
        </p>
      )}
    </div>
  );
}
