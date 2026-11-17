import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuidesFresh } from "@/lib/guides";
import { listProducts } from "@/lib/admin-data";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, Pill, btn, field, textarea } from "@/components/admin/ui";
import { Markdown } from "@/components/markdown";
import { saveGuide } from "../../actions";

export const metadata = { title: "Guía" };

export default async function GuidePage({ params, searchParams }: PageProps<"/admin/marketing/guias/[slug]">) {
  await connection();
  const { slug } = await params;
  const sp = await searchParams;
  const [guides, products] = await Promise.all([getGuidesFresh(), listProducts()]);
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) notFound();
  const linked = guide.productIds.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean);
  const published = guide.status === "publicada";

  return (
    <>
      <Link href="/admin/marketing" className="text-sm text-ink-soft hover:text-ink">← Marketing</Link>
      <PageHeader
        title={guide.title}
        description={sp.guardada ? "Cambios guardados." : `Responde a la búsqueda «${guide.keyword}». Revisa que las medidas y los datos sean correctos antes de publicar.`}
        actions={
          <div className="flex items-center gap-2">
            <Pill tone={published ? "ok" : guide.status === "borrador" ? "wait" : "neutral"}>{guide.status}</Pill>
            {published && <Link href={`/guias/${guide.slug}`} target="_blank" className={btn.secondary}>Ver en la tienda</Link>}
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Editar">
          <ActionForm action={saveGuide} className="space-y-4">
            <input type="hidden" name="slug" value={guide.slug} />
            <Field label="Título">
              <input name="title" defaultValue={guide.title} className={field} required />
            </Field>
            <Field label="Dirección" hint={published ? "No se puede cambiar después de publicar (rompería los enlaces)." : "Solo letras, números y guiones."}>
              <div className="flex items-center gap-1 text-sm text-ink-mute">
                /guias/
                <input name="newSlug" defaultValue={guide.slug} disabled={published} className={field} />
              </div>
            </Field>
            <Field label="Descripción para Google" hint="Lo que aparece bajo el título en los resultados de búsqueda. Máximo 160 caracteres.">
              <textarea name="description" defaultValue={guide.description} rows={2} maxLength={170} className={textarea} />
            </Field>
            <Field label="Texto" hint="## Subtítulo · ### Sección · - lista · **negrita** · [texto](/producto/slug)">
              <textarea name="body" defaultValue={guide.body} rows={24} className={`${textarea} font-mono text-xs leading-relaxed`} />
            </Field>
            {linked.length > 0 && <p className="text-xs text-ink-mute">Productos enlazados: {linked.join(", ")}</p>}
            <div className="flex flex-wrap gap-2">
              <button className={btn.secondary}>Guardar</button>
              {!published && <button name="status" value="publicada" className={btn.primary}>Guardar y publicar</button>}
              {guide.status !== "descartada" && <button name="status" value={published ? "borrador" : "descartada"} className={btn.danger}>{published ? "Despublicar" : "Descartar"}</button>}
              {guide.status === "descartada" && <button name="status" value="borrador" className={btn.secondary}>Recuperar como borrador</button>}
            </div>
          </ActionForm>
        </Card>

        <Card title="Vista previa">
          <p className="text-xs tracking-[0.2em] text-accent uppercase">Guía</p>
          <h2 className="mt-2 font-display text-3xl font-light">{guide.title}</h2>
          <p className="mt-2 text-sm text-ink-mute">{guide.description}</p>
          <div className="mt-4 [&_.text-lg]:text-base">
            <Markdown text={guide.body} />
          </div>
          <p className="mt-6 text-xs text-ink-mute">La vista previa muestra lo guardado. Guarda para ver tus cambios.</p>
        </Card>
      </div>
    </>
  );
}
