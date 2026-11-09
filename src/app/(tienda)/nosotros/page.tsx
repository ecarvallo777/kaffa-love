import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import foto from "../../../../public/nosotros/kaffa-love-tostadores.jpg";

export const metadata: Metadata = {
  title: "Nosotros",
  description:
    "Kaffa Love nace del amor por el café. Somos una pareja de tostadores que selecciona granos de altura y los tuesta artesanalmente en pequeños lotes.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16">
      <div className="grid items-start gap-10 md:grid-cols-[0.85fr_1fr] md:gap-16">
        <figure className="md:sticky md:top-32">
          <div className="overflow-hidden rounded-3xl bg-paper-2 shadow-[0_24px_60px_-30px_rgba(60,35,15,0.45)]">
            <Image
              src={foto}
              alt="Los tostadores de Kaffa Love preparando café de filtro con una tetera cuello de cisne"
              placeholder="blur"
              priority
              sizes="(min-width: 768px) 420px, 100vw"
              className="h-auto w-full"
            />
          </div>
          <figcaption className="mt-3 text-center text-sm text-ink-mute">Los tostadores detrás de cada bolsa.</figcaption>
        </figure>

        <article>
          <p className="text-xs tracking-[0.2em] text-accent uppercase">Nosotros</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-light tracking-tight text-balance sm:text-6xl">
            Kaffa Love nace del <span className="italic">amor</span> por el café
          </h1>

          <div className="mt-8 space-y-6 text-lg leading-relaxed text-ink-soft">
            <p>
              Kaffa Love nace del amor por el café, la vida con propósito y los rituales que nos conectan con lo esencial. Somos una
              pareja de tostadores apasionados, unidos por el deseo de compartir cafés de especialidad con historia, origen y propósito.
            </p>

            <blockquote className="border-l-2 border-accent py-1 pl-6 font-display text-2xl leading-snug font-light text-ink italic">
              Creemos que el café es más que una bebida: es una experiencia sensorial, un puente entre personas y culturas, un momento
              de pausa en la rutina.
            </blockquote>

            <p>
              Por eso, seleccionamos granos de altura y los tostamos artesanalmente en pequeños lotes, cuidando cada detalle del proceso
              para resaltar su dulzura natural, acidez brillante y cuerpo sedoso.
            </p>
            <p>
              Nuestra tienda es una extensión de nuestra vida. Aquí encontrarás lo que usamos a diario: café que amamos, métodos de
              preparación que disfrutamos y accesorios que hemos probado personalmente. Desde una prensa francesa hasta un buen
              molinillo, cada producto tiene una razón de estar aquí.
            </p>
            <p>
              Nos mueve la transparencia, la calidad y el deseo de inspirar a más personas a descubrir el café con intención. Si llegaste
              hasta aquí, gracias por compartir este viaje con nosotros. Te invitamos a formar parte de la comunidad{" "}
              <strong className="font-medium text-ink">Kaffa Lovers</strong> y disfrutar del café como lo hacemos nosotros: con amor,
              respeto y curiosidad.
            </p>
          </div>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
            {[
              ["Granos de altura", "Cafés de especialidad con origen y trazabilidad"],
              ["Pequeños lotes", "Tostado artesanal, cuidando cada detalle"],
              ["Probado por nosotros", "Cada método y accesorio lo usamos a diario"],
            ].map(([t, d]) => (
              <li key={t} className="bg-paper p-5">
                <p className="font-display text-lg">{t}</p>
                <p className="mt-1 text-sm text-ink-soft">{d}</p>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/categoria/cafe-de-especialidad"
              className="inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-accent"
            >
              Conoce nuestros cafés
            </Link>
            <Link
              href="/categoria/cafeteria-hogar"
              className="inline-flex h-12 items-center rounded-full border border-ink/20 px-6 font-medium transition-colors hover:border-ink"
            >
              Lo que usamos para prepararlo
            </Link>
          </div>
        </article>
      </div>
    </div>
  );
}
