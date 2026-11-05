import Link from "next/link";
import { Suspense } from "react";
import { getCatalog } from "@/lib/catalog";
import { categoryHref, topCategories } from "@/lib/catalog-utils";
import { Wordmark } from "@/components/wordmark";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-ink text-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Wordmark className="[&_span]:text-paper" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">
            Café de especialidad tostado en Chile y todo lo necesario para prepararlo bien en casa.
          </p>
        </div>
        <div>
          <h2 className="text-xs tracking-[0.16em] text-paper/50 uppercase">Tienda</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <Suspense>
              <CategoryLinks />
            </Suspense>
          </ul>
        </div>
        <div>
          <h2 className="text-xs tracking-[0.16em] text-paper/50 uppercase">Compra tranquilo</h2>
          <ul className="mt-4 space-y-2 text-sm text-paper/80">
            <li>Pago con Mercado Pago</li>
            <li>Despacho a domicilio</li>
            <li>Retiro sin costo</li>
            <li>Boleta electrónica</li>
          </ul>
        </div>
        <div>
          <h2 className="text-xs tracking-[0.16em] text-paper/50 uppercase">Información</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/legal/terminos" className="text-paper/80 hover:text-paper">Términos y condiciones</Link></li>
            <li><Link href="/legal/cambios-y-devoluciones" className="text-paper/80 hover:text-paper">Cambios y devoluciones</Link></li>
            <li><Link href="/legal/privacidad" className="text-paper/80 hover:text-paper">Privacidad</Link></li>
            <li><Link href="/contacto" className="text-paper/80 hover:text-paper">Contacto</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-paper/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-paper/50 sm:px-6">
          © Kaffa Love · Precios en pesos chilenos con IVA incluido
        </p>
      </div>
    </footer>
  );
}

async function CategoryLinks() {
  const categories = topCategories(await getCatalog());
  return categories.map((c) => (
    <li key={c.id}>
      <Link href={categoryHref(c)} className="text-paper/80 hover:text-paper">
        {c.name}
      </Link>
    </li>
  ));
}
