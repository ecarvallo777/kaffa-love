import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublishedGuides } from "@/lib/guides";
import { getCatalog } from "@/lib/catalog";
import { Markdown } from "@/components/markdown";
import { ProductCard } from "@/components/product-card";

// Con Cache Components hace falta al menos un valor: sin guías publicadas, uno que responde 404
const PLACEHOLDER = "__sin-guias__";

export async function generateStaticParams() {
  const guides = await getPublishedGuides();
  return guides.length ? guides.map((g) => ({ slug: g.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata(props: PageProps<"/guias/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const g = (await getPublishedGuides()).find((x) => x.slug === slug);
  if (!g) return {};
  return { title: g.title, description: g.description, alternates: { canonical: `/guias/${g.slug}` } };
}

export default function GuidePage(props: PageProps<"/guias/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto min-h-[60vh] max-w-3xl px-4 pt-16" />}>
      <GuideView params={props.params} />
    </Suspense>
  );
}

async function GuideView({ params }: Pick<PageProps<"/guias/[slug]">, "params">) {
  const { slug } = await params;
  const [guides, catalog] = await Promise.all([getPublishedGuides(), getCatalog()]);
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();
  const products = guide.productIds.map((id) => catalog.products.find((p) => p.id === id)).filter((p) => p !== undefined);
  const others = guides.filter((g) => g.slug !== guide.slug).slice(0, 3);
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    mainEntityOfPage: `${site}/guias/${guide.slug}`,
    author: { "@type": "Organization", name: "Kaffa Love" },
    publisher: { "@type": "Organization", name: "Kaffa Love", logo: { "@type": "ImageObject", url: `${site}/brand/logo-horizontal.png` } },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 sm:pt-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Link href="/guias" className="text-sm text-ink-soft hover:text-ink">← Guías</Link>
      <article className="mt-6">
        <p className="text-xs tracking-[0.2em] text-accent uppercase">Guía</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-light tracking-tight text-balance sm:text-5xl">{guide.title}</h1>
        <p className="mt-4 text-lg text-ink-soft">{guide.description}</p>
        <div className="mt-6">
          <Markdown text={guide.body} />
        </div>
      </article>

      {products.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-3xl font-light">Para prepararlo</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {products.map((p) => <ProductCard key={p.id} product={p} catalog={catalog} />)}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-16">
          <h2 className="font-display text-2xl font-light">Más guías</h2>
          <ul className="mt-4 space-y-2">
            {others.map((g) => (
              <li key={g.slug}><Link href={`/guias/${g.slug}`} className="text-accent underline-offset-4 hover:underline">{g.title}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
