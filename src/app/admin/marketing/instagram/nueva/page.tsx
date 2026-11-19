import { connection } from "next/server";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMarketingRuns } from "@/lib/marketing/agent";
import { getInstagramAccount, type IgKind } from "@/lib/marketing/instagram";
import { isoToChileLocal } from "@/lib/format";
import { Empty, PageHeader } from "@/components/admin/ui";
import { InstagramComposer } from "./composer";

export const metadata = { title: "Publicar en Instagram" };
// "Publicar ahora" espera a que Instagram procese los videos
export const maxDuration = 300;

/** Por defecto: mañana a las 19:00, hora de Chile (buena hora para Instagram) */
function defaultSchedule() {
  return `${isoToChileLocal(new Date(Date.now() + 86400_000)).slice(0, 10)}T19:00`;
}

const KIND_OF: Record<string, IgKind> = { post: "feed", carrusel: "feed", reel: "reel", historia: "historia" };

export default async function NewInstagramPage({ searchParams }: PageProps<"/admin/marketing/instagram/nueva">) {
  await connection();
  const sp = await searchParams;
  const [account, runs, products] = await Promise.all([
    getInstagramAccount(),
    getMarketingRuns(),
    createAdminClient().from("products").select("slug, name, image_urls").eq("active", true).order("name"),
  ]);

  const run = runs.find((r) => r.id === sp.plan);
  const index = Number(sp.post);
  const post = run?.posts[index];
  const withPhotos = (products.data ?? []).filter((p) => p.image_urls.length > 0).map((p) => ({ slug: p.slug, name: p.name, images: p.image_urls as string[] }));
  // El producto del post va primero
  if (post?.productSlug) withPhotos.sort((a, b) => Number(b.slug === post.productSlug) - Number(a.slug === post.productSlug));

  const defaultAt = defaultSchedule();

  return (
    <>
      <Link href="/admin/marketing" className="text-sm text-ink-soft hover:text-ink">← Marketing</Link>
      <PageHeader
        title="Publicar en Instagram"
        description={
          post
            ? `Del plan de la semana: ${post.hook}`
            : "Sube las fotos o el video, revisa el texto y elige cuándo publicarlo."
        }
      />
      {!account ? (
        <Empty>
          Instagram no está conectado. Conéctalo en <Link href="/admin/marketing#instagram" className="underline">Admin → Marketing</Link>.
        </Empty>
      ) : (
        <InstagramComposer
          username={account.username}
          initial={{
            kind: post ? KIND_OF[post.format] : "feed",
            caption: post ? `${post.caption}\n\n${post.hashtags.map((h) => `#${h}`).join(" ")}` : "",
            photoIdea: post?.photo ?? null,
            link: post?.link ?? null,
            scheduledAt: defaultAt,
            source: post && run ? { runId: run.id, index } : null,
          }}
          products={withPhotos}
        />
      )}
    </>
  );
}
