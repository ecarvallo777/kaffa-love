import { connection } from "next/server";
import Link from "next/link";
import { getMarketingRuns, type MarketingPost } from "@/lib/marketing/agent";
import { getGuidesFresh, type GuideStatus } from "@/lib/guides";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Empty, PageHeader, Pill, Table, btn } from "@/components/admin/ui";
import { generateMarketing, setPostStatus, toggleAction } from "./actions";
import { CopyButton } from "./copy-button";
import { InstagramSection } from "./instagram-section";
import { getInstagramAccount, getInstagramQueue } from "@/lib/marketing/instagram";

export const metadata = { title: "Marketing" };
// Generar el plan con Claude tarda 1 a 2 minutos
export const maxDuration = 300;

const FORMAT: Record<MarketingPost["format"], string> = { post: "Post", carrusel: "Carrusel", historia: "Historia", reel: "Reel" };
const GUIDE_TONE: Record<GuideStatus, "ok" | "wait" | "neutral"> = { publicada: "ok", borrador: "wait", descartada: "neutral" };

export default async function MarketingPage({ searchParams }: PageProps<"/admin/marketing">) {
  await connection();
  const sp = await searchParams;
  const [runs, guides, igAccount, igQueue] = await Promise.all([getMarketingRuns(), getGuidesFresh(), getInstagramAccount(), getInstagramQueue()]);
  const run = runs.find((r) => r.id === sp.plan) ?? runs[0];
  const guide = run?.guideSlug ? guides.find((g) => g.slug === run.guideSlug) : undefined;

  return (
    <>
      <PageHeader
        title="Marketing"
        description="Cada lunes a las 7:00 el agente revisa las ventas, los canales y el catálogo, y deja listas 3 acciones, 4 publicaciones de Instagram y una guía para la web. Nada se publica sin tu aprobación."
        actions={
          <ActionForm action={generateMarketing} className="flex flex-col items-end">
            <button className={btn.secondary}>Generar plan ahora</button>
            <span className="mt-1 text-xs text-ink-mute">Tarda 1 a 2 minutos · unos US$ 0,30</span>
          </ActionForm>
        }
      />

      <div id="instagram" className="mb-6 scroll-mt-6">
        <InstagramSection account={igAccount} queue={igQueue} message={typeof sp.ig === "string" ? sp.ig : null} />
      </div>

      {!run ? (
        <Empty>Todavía no hay planes. El primero llega el lunes a las 7:00, o genéralo ahora con el botón de arriba.</Empty>
      ) : (
        <div className="space-y-6">
          <Card
            title={`Semana del ${new Date(`${run.week}T12:00:00Z`).toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "UTC" })}`}
            actions={<span className="text-xs text-ink-mute">{fmtDateTime(run.createdAt)} · {run.by}{run.usage.costUsd !== null && ` · US$ ${run.usage.costUsd.toFixed(2)}`}</span>}
          >
            <p className="leading-relaxed text-ink-soft">{run.summary}</p>
            <p className="mt-3 text-xs text-ink-mute">Búsquedas de Google: {run.searchConsole}</p>
          </Card>

          <Card title="Acciones de la semana">
            <ol className="space-y-4">
              {run.actions.map((a, i) => (
                <li key={i} className="flex gap-3">
                  <ActionForm action={toggleAction}>
                    <input type="hidden" name="run" value={run.id} />
                    <input type="hidden" name="index" value={i} />
                    <button
                      aria-label={a.done ? "Marcar como pendiente" : "Marcar como hecha"}
                      className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs ${a.done ? "border-leaf bg-leaf text-white" : "border-line bg-white hover:border-ink"}`}
                    >
                      {a.done ? "✓" : ""}
                    </button>
                  </ActionForm>
                  <div className={a.done ? "opacity-60" : ""}>
                    <p className={`font-medium ${a.done ? "line-through" : ""}`}>{a.title}</p>
                    <p className="mt-1 text-sm text-ink-soft"><span className="text-ink-mute">Por qué: </span>{a.why}</p>
                    <p className="mt-1 text-sm whitespace-pre-line text-ink-soft"><span className="text-ink-mute">Cómo: </span>{a.how}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <section>
            <h2 className="mb-3 font-display text-xl">Publicaciones de Instagram</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {run.posts.map((p, i) => {
                const full = `${p.caption}\n\n${p.hashtags.map((h) => `#${h}`).join(" ")}`;
                const scheduled = igQueue.filter((q) => q.source?.runId === run.id && q.source.index === i && q.status !== "cancelada").at(-1);
                return (
                  <article key={i} className={`flex flex-col rounded-2xl border border-line bg-white/60 p-5 ${p.status === "descartado" ? "opacity-50" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="info">{FORMAT[p.format]}</Pill>
                      <Pill>{p.day}</Pill>
                      {p.status === "publicado" && <Pill tone="ok">Publicada</Pill>}
                      {p.status === "descartado" && <Pill>Descartada</Pill>}
                      {scheduled && scheduled.status !== "publicada" && (
                        <Pill tone={scheduled.status === "error" ? "bad" : "wait"}>
                          {scheduled.status === "error" ? "Error en Instagram" : `Programada ${fmtDateTime(scheduled.scheduledAt)}`}
                        </Pill>
                      )}
                    </div>
                    <p className="mt-3 text-xs text-ink-mute">{p.goal}</p>
                    <p className="mt-2 font-medium">{p.hook}</p>
                    <p className="mt-2 text-sm whitespace-pre-line text-ink-soft">{p.caption}</p>
                    <p className="mt-2 text-sm text-accent">{p.hashtags.map((h) => `#${h}`).join(" ")}</p>
                    <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-soft"><span className="font-medium text-ink">Foto: </span>{p.photo}</p>
                    <p className="mt-2 truncate text-xs text-ink-mute" title={p.link}>Enlace (bio o sticker): {p.link}</p>
                    <div className="mt-4 flex flex-wrap gap-2 pt-1">
                      {igAccount && p.status === "pendiente" && !scheduled && (
                        <Link href={`/admin/marketing/instagram/nueva?plan=${run.id}&post=${i}`} className={btn.primary}>Programar en Instagram</Link>
                      )}
                      <CopyButton text={full} label="Copiar texto" />
                      <CopyButton text={p.link} label="Copiar enlace" />
                      {p.status !== "publicado" && (
                        <ActionForm action={setPostStatus}>
                          <input type="hidden" name="run" value={run.id} />
                          <input type="hidden" name="index" value={i} />
                          <input type="hidden" name="status" value="publicado" />
                          <button className={btn.primary}>Ya la publiqué</button>
                        </ActionForm>
                      )}
                      <ActionForm action={setPostStatus}>
                        <input type="hidden" name="run" value={run.id} />
                        <input type="hidden" name="index" value={i} />
                        <input type="hidden" name="status" value={p.status === "pendiente" ? "descartado" : "pendiente"} />
                        <button className={btn.secondary}>{p.status === "pendiente" ? "Descartar" : "Volver a pendiente"}</button>
                      </ActionForm>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <Card title="Guía de la semana">
            {guide ? (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{guide.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">Responde a la búsqueda «{guide.keyword}»</p>
                </div>
                <div className="flex items-center gap-2">
                  <Pill tone={GUIDE_TONE[guide.status]}>{guide.status}</Pill>
                  <Link href={`/admin/marketing/guias/${guide.slug}`} className={btn.primary}>Revisar y publicar</Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">Esta semana el agente no propuso una guía.</p>
            )}
          </Card>
        </div>
      )}

      <h2 className="mt-10 mb-3 font-display text-xl">Guías</h2>
      {guides.length ? (
        <Table>
          <thead>
            <tr>
              <th>Guía</th>
              <th>Búsqueda</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {[...guides].reverse().map((g) => (
              <tr key={g.slug}>
                <td>
                  <Link href={`/admin/marketing/guias/${g.slug}`} className="font-medium underline-offset-4 hover:underline">{g.title}</Link>
                  <span className="block text-xs text-ink-mute">/guias/{g.slug}</span>
                </td>
                <td className="text-ink-soft">{g.keyword}</td>
                <td><Pill tone={GUIDE_TONE[g.status]}>{g.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>Aún no hay guías.</Empty>
      )}

      {runs.length > 1 && (
        <>
          <h2 className="mt-10 mb-3 font-display text-xl">Planes anteriores</h2>
          <ul className="space-y-1 text-sm">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/marketing?plan=${r.id}`} className={`underline-offset-4 hover:underline ${r.id === run?.id ? "font-medium" : "text-ink-soft"}`}>
                  Semana del {r.week}
                </Link>
                <span className="text-ink-mute"> · {r.posts.filter((p) => p.status === "publicado").length} de {r.posts.length} publicadas · {fmtDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
