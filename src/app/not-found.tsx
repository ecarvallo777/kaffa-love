import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs tracking-[0.2em] text-accent uppercase">Error 404</p>
      <h1 className="mt-3 font-display text-4xl font-light sm:text-5xl">
        Esta taza está <span className="italic">vacía</span>.
      </h1>
      <p className="mt-4 text-ink-soft">
        No encontramos lo que buscas. Puede que el producto ya no esté disponible esta temporada.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper hover:bg-accent"
      >
        Volver a la tienda
      </Link>
    </div>
  );
}
