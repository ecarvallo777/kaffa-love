"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { slugify } from "@/lib/slug";
import { getMarketingRuns, runMarketingAgent, saveMarketingRuns, type PostStatus } from "@/lib/marketing/agent";
import { getGuidesFresh, saveGuides, type GuideStatus } from "@/lib/guides";
import { fmtDateTime, chileLocalToIso } from "@/lib/format";
import {
  MEDIA_BUCKET,
  addPublication,
  connectInstagram,
  createUploadTargets,
  disconnectInstagram,
  getInstagramAccount,
  publishNow,
  removeMedia,
  updatePublication,
  validateMedia,
  type IgKind,
  type IgMedia,
  type IgPublication,
} from "@/lib/marketing/instagram";
import type { ActionResult } from "@/components/admin/action-form";
import { connectMetaPixel, disconnectMetaPixel, sendMetaTestEvent } from "@/lib/marketing/meta-pixel";

export async function generateMarketing(): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  try {
    const run = await runMarketingAgent(staff.email);
    refresh();
    const cost = run.usage.costUsd === null ? "" : ` Costo: US$ ${run.usage.costUsd.toFixed(2)}.`;
    return { ok: `Plan listo: ${run.posts.length} publicaciones${run.guideSlug ? " y una guía" : ""}.${cost}` };
  } catch (e) {
    console.error("[marketing]", (e as Error).message);
    return { error: `No se pudo preparar el plan: ${(e as Error).message}` };
  }
}

async function updateRun(id: string, change: (run: Awaited<ReturnType<typeof getMarketingRuns>>[number]) => void) {
  const runs = await getMarketingRuns();
  const run = runs.find((r) => r.id === id);
  if (!run) return false;
  change(run);
  await saveMarketingRuns(runs);
  return true;
}

export async function setPostStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const index = Number(form.get("index"));
  const status = String(form.get("status")) as PostStatus;
  if (!["pendiente", "publicado", "descartado"].includes(status)) return { error: "Estado no válido." };
  const ok = await updateRun(String(form.get("run")), (run) => {
    if (run.posts[index]) run.posts[index].status = status;
  });
  if (!ok) return { error: "No encontramos ese plan." };
  refresh();
  return { ok: status === "publicado" ? "Marcada como publicada." : status === "descartado" ? "Descartada." : "Vuelve a pendiente." };
}

export async function toggleAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const index = Number(form.get("index"));
  const ok = await updateRun(String(form.get("run")), (run) => {
    if (run.actions[index]) run.actions[index].done = !run.actions[index].done;
  });
  if (!ok) return { error: "No encontramos ese plan." };
  refresh();
  return null;
}

export async function saveGuide(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const slug = String(form.get("slug") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const status = String(form.get("status") ?? "") as GuideStatus | "";
  if (title.length < 5) return { error: "El título es muy corto." };
  if (body.length < 300) return { error: "El texto es muy corto para una guía." };
  if (description.length > 170) return { error: "La descripción para Google debe tener como máximo 160 caracteres." };

  const guides = await getGuidesFresh();
  const guide = guides.find((g) => g.slug === slug);
  if (!guide) return { error: "No encontramos esa guía." };

  // La dirección solo se puede cambiar mientras no se publique (después rompería los enlaces)
  const newSlug = slugify(String(form.get("newSlug") ?? "")) || guide.slug;
  if (guide.status !== "publicada" && newSlug !== guide.slug) {
    if (guides.some((g) => g.slug === newSlug)) return { error: "Ya existe otra guía con esa dirección." };
    guide.slug = newSlug;
  }
  Object.assign(guide, { title, description, body, updatedAt: new Date().toISOString() });
  if (status && status !== guide.status) {
    guide.status = status;
    if (status === "publicada" && !guide.publishedAt) guide.publishedAt = new Date().toISOString();
    await logEvent(status === "publicada" ? "guia_publicada" : "guia_actualizada", "guide", null, { guia: guide.slug, estado: status, por: staff.email });
  }
  await saveGuides(guides);
  updateTag("guides");
  if (guide.slug !== slug) redirect(`/admin/marketing/guias/${guide.slug}?guardada=1`);
  refresh();
  return {
    ok: guide.status === "publicada" ? `Guía publicada en kaffalove.cl/guias/${guide.slug}.` : guide.status === "descartada" ? "Guía descartada." : "Borrador guardado.",
  };
}

// --- Instagram -----------------------------------------------------------------------------

export async function connectInstagramAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const token = String(form.get("token") ?? "").trim();
  if (token.length < 40) return { error: "Pega el token completo que generaste en el panel de Meta." };
  try {
    const appSecret = String(form.get("appSecret") ?? "").trim() || undefined;
    const appId = String(form.get("appId") ?? "").replace(/\D/g, "") || undefined;
    const igId = String(form.get("igId") ?? "").replace(/\D/g, "") || undefined;
    const username = await connectInstagram(token, staff.email, appSecret, appId, igId);
    refresh();
    return { ok: `Conectado como @${username}.` };
  } catch (e) {
    return { error: `No se pudo conectar: ${(e as Error).message}` };
  }
}

export async function disconnectInstagramAction(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  await disconnectInstagram();
  backToInstagram("Instagram desconectado.");
}

/** Lo llama el navegador antes de subir: una URL firmada por archivo */
export async function prepareInstagramUploads(files: { type: IgMedia["type"]; contentType: string }[]) {
  await requireStaff(["admin"]);
  if (!Array.isArray(files) || !files.length || files.length > 20) throw new Error("Cantidad de archivos no válida.");
  if (files.some((f) => !["image", "video"].includes(f.type) || !["image/jpeg", "video/mp4", "video/quicktime"].includes(f.contentType))) {
    throw new Error("Solo se aceptan fotos JPG y videos MP4 o MOV.");
  }
  return createUploadTargets(files);
}

export type NewPublication = {
  kind: IgKind;
  caption: string;
  media: IgMedia[];
  /** "AAAA-MM-DDTHH:MM" en hora de Chile; vacío = publicar ahora */
  scheduledAt: string;
  source: { runId: string; index: number } | null;
};

export async function createInstagramPublication(input: NewPublication): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  if (!(await getInstagramAccount())) return { error: "Primero conecta Instagram en Admin → Marketing." };
  if (!["feed", "reel", "historia"].includes(input.kind)) return { error: "Formato no válido." };
  const caption = String(input.caption ?? "").trim();
  if (caption.length > 2200) return { error: "El texto tiene más de 2.200 caracteres (el máximo de Instagram)." };
  if ((caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).length > 30) return { error: "Instagram acepta como máximo 30 hashtags." };
  // Solo archivos subidos a nuestro espacio de Instagram
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/`;
  const media = (input.media ?? []).map((m) => ({ path: String(m.path), url: String(m.url), type: m.type }));
  if (media.some((m) => !m.path.startsWith("media/") || m.url !== base + m.path || !["image", "video"].includes(m.type))) {
    return { error: "Hay un archivo que no se subió correctamente. Vuelve a agregarlo." };
  }
  const invalid = validateMedia(input.kind, media);
  if (invalid) return { error: invalid };

  const now = !input.scheduledAt;
  const scheduledAt = now ? new Date().toISOString() : chileLocalToIso(input.scheduledAt);
  if (!scheduledAt) return { error: "Revisa la fecha y hora." };
  if (!now && new Date(scheduledAt) < new Date(Date.now() - 60_000)) return { error: "Esa fecha ya pasó. Elige una futura o usa «Publicar ahora»." };

  const id = crypto.randomUUID();
  const stamp = new Date().toISOString();
  await addPublication({
    id,
    kind: input.kind,
    caption: input.kind === "historia" ? "" : caption,
    media,
    scheduledAt,
    status: "programada",
    source: input.source && typeof input.source.runId === "string" ? { runId: input.source.runId, index: Number(input.source.index) } : null,
    createdAt: stamp,
    createdBy: staff.email,
    updatedAt: stamp,
  });
  await logEvent("instagram_programado", "instagram", null, { publicacion: id, tipo: input.kind, archivos: media.length, para: scheduledAt, por: staff.email });
  if (!now) {
    refresh();
    return { ok: `Programada para el ${fmtDateTime(scheduledAt)}. Se publica sola a esa hora.` };
  }
  return publishResult(await publishNow(id));
}

function publishResult(p: IgPublication | null): ActionResult {
  refresh();
  if (!p) return { error: "No encontramos esa publicación." };
  if (p.status === "publicada") return { ok: "¡Publicado en Instagram!" };
  if (p.status === "error") return { error: p.error ?? "Instagram no pudo publicarla." };
  return { ok: "Instagram sigue procesando el video. Se publica sola en los próximos minutos." };
}

/** La fila sale de la tabla al publicarse o cancelarse: el mensaje se muestra arriba de la sección */
function backToInstagram(message: string): never {
  redirect(`/admin/marketing?ig=${encodeURIComponent(message)}#instagram`);
}

export async function publishNowAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  let result: ActionResult;
  try {
    result = publishResult(await publishNow(String(form.get("id"))));
  } catch (e) {
    return { error: (e as Error).message };
  }
  // Con error la fila sigue en la tabla y muestra el mensaje ahí mismo
  if (result?.ok) backToInstagram(result.ok);
  return result;
}

export async function cancelPublicationAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  let media: IgMedia[] = [];
  const p = await updatePublication(String(form.get("id")), (x) => {
    if (x.status === "programada" || x.status === "error" || (x.status === "procesando" && !x.published?.some(Boolean))) {
      x.status = "cancelada";
      x.lockUntil = null;
      media = x.media;
    }
  });
  if (!p) return { error: "No encontramos esa publicación." };
  if (p.status !== "cancelada") return { error: "Ya se está publicando; no se puede cancelar." };
  await removeMedia(media);
  backToInstagram("Publicación cancelada.");
}

// Píxel de Meta y API de conversiones ------------------------------------------------

export async function connectMetaPixelAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const pixelId = String(form.get("pixelId") ?? "").replace(/\D/g, "");
  const token = String(form.get("token") ?? "").trim();
  const testEventCode = String(form.get("testEventCode") ?? "").trim() || null;
  if (token.length < 40) return { error: "Pega el token completo de la API de conversiones." };
  try {
    const { name } = await connectMetaPixel(pixelId, token, testEventCode, staff.email);
    updateTag("meta-pixel");
    refresh();
    return { ok: `Conectado${name ? ` a «${name}»` : ""}. El píxel ya está en la tienda.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function disconnectMetaPixelAction(): Promise<ActionResult> {
  await requireStaff(["admin"]);
  await disconnectMetaPixel();
  updateTag("meta-pixel");
  refresh();
  return { ok: "Píxel quitado de la tienda." };
}

export async function testMetaPixelAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff(["admin"]);
  const code = String(form.get("testEventCode") ?? "").trim();
  if (!/^TEST\w+$/i.test(code)) return { error: "Copia el código de «Probar eventos» (empieza con TEST)." };
  try {
    const n = await sendMetaTestEvent(code);
    return { ok: `Meta recibió ${n} evento de prueba. Míralo en Administrador de eventos → Probar eventos.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
