import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readConfigJson, writeConfigJson } from "@/lib/config-store";
import { logEvent } from "@/lib/events";
import { getMarketingRuns, saveMarketingRuns } from "@/lib/marketing/agent";

/*
 * Publicación en Instagram desde Admin → Marketing (API de Instagram con inicio de sesión de Instagram).
 *
 * - La conexión es un token de larga duración (60 días) generado en el panel de la app de Meta y
 *   pegado en Admin → Marketing. Se guarda en config/clave-instagram.json (fuera del respaldo)
 *   y la tarea periódica lo renueva cada semana.
 * - Las fotos y videos se suben desde el navegador al bucket público "instagram" (Instagram los
 *   descarga desde ahí) y se borran cuando la publicación sale.
 * - Cada publicación avanza por pasos en la tarea de cada 5 minutos (o al instante con
 *   "Publicar ahora"): crear contenedores → esperar que Instagram procese los videos →
 *   publicar. Nada se publica sin que una persona lo haya programado.
 */

// INSTAGRAM_API_URL solo para pruebas locales contra un Instagram simulado (scripts/e2e/instagram.mjs)
const API = (process.env.NODE_ENV !== "production" && process.env.INSTAGRAM_API_URL) || "https://graph.instagram.com/v27.0";
const TOKEN_FILE = "clave-instagram.json";
const QUEUE_FILE = "instagram.json";
export const MEDIA_BUCKET = "instagram";
/** Límite de archivo de Supabase en el plan gratis */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const KEEP_FINISHED = 60;
/** Los contenedores de Instagram vencen a las 24 horas */
const CONTAINER_TTL_MS = 23 * 3600_000;
const LOCK_MS = 4 * 60_000;

export type IgKind = "feed" | "reel" | "historia";
export type IgMedia = { path: string; url: string; type: "image" | "video" };
export type IgStatus = "programada" | "procesando" | "publicada" | "error" | "cancelada";

export type IgPublication = {
  id: string;
  kind: IgKind;
  caption: string;
  media: IgMedia[];
  scheduledAt: string;
  status: IgStatus;
  /** Publicación del plan semanal de la que viene, si corresponde */
  source: { runId: string; index: number } | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  /** Contenedores de los elementos de un carrusel */
  children?: string[];
  /** Contenedores a publicar: uno, o uno por historia */
  containers?: string[];
  containersAt?: string;
  /** Ids ya publicados, alineados con `containers` (las historias salen de a una) */
  published?: (string | null)[];
  /** Si se cortó justo al publicar, no se reintenta solo: podría duplicarse */
  publishing?: number | null;
  permalinks?: string[];
  publishedAt?: string;
  error?: string | null;
  lockUntil?: string | null;
};

type TokenStore = { token: string; userId: string; username: string; connectedAt: string; refreshedAt: string; expiresAt: string | null };

export const KIND_LABEL: Record<IgKind, string> = { feed: "Publicación", reel: "Reel", historia: "Historia" };

// --- Conexión --------------------------------------------------------------------------

async function getTokenStore() {
  return readConfigJson<TokenStore | null>(TOKEN_FILE, null);
}

export async function getInstagramAccount() {
  const t = await getTokenStore();
  return t ? { username: t.username, connectedAt: t.connectedAt, refreshedAt: t.refreshedAt, expiresAt: t.expiresAt } : null;
}

class IgError extends Error {
  readonly code: number | null;
  constructor(message: string, code: number | null) {
    super(message);
    this.code = code;
  }
}

async function ig<T>(method: "GET" | "POST", path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${API}${path}`);
  const body = new URLSearchParams({ ...params, access_token: token });
  const res =
    method === "GET"
      ? await fetch(`${url}${url.search ? "&" : "?"}${body}`, { cache: "no-store" })
      : await fetch(url, { method, body, cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string } } & T;
  if (!res.ok || json.error) {
    const e = json.error;
    throw new IgError(e?.error_user_msg || e?.message || `Instagram respondió ${res.status}`, e?.code ?? res.status);
  }
  return json;
}

/** Valida un token pegado en el admin y lo guarda */
export async function connectInstagram(token: string, by: string) {
  const me = await ig<{ user_id?: string; username?: string; account_type?: string; data?: { user_id: string; username: string }[] }>(
    "GET",
    "/me",
    token,
    { fields: "user_id,username,account_type" },
  );
  const info = me.data?.[0] ?? me;
  if (!info.user_id || !info.username) throw new Error("Instagram no devolvió la cuenta. Revisa que el token sea de la cuenta profesional.");
  const now = new Date().toISOString();
  await writeConfigJson(TOKEN_FILE, {
    token,
    userId: String(info.user_id),
    username: info.username,
    connectedAt: now,
    refreshedAt: now,
    expiresAt: new Date(Date.now() + 60 * 86400_000).toISOString(),
  } satisfies TokenStore);
  await logEvent("instagram_conectado", "instagram", null, { cuenta: info.username, por: by });
  return info.username;
}

export async function disconnectInstagram() {
  await createAdminClient().storage.from("config").remove([TOKEN_FILE]);
}

/** Renueva el token si tiene más de 7 días (dura 60 y solo se puede renovar después de 24 horas) */
async function refreshTokenIfNeeded(t: TokenStore) {
  if (Date.now() - new Date(t.refreshedAt).getTime() < 7 * 86400_000) return t;
  try {
    const r = await ig<{ access_token: string; expires_in: number }>("GET", "https://graph.instagram.com/refresh_access_token", t.token, {
      grant_type: "ig_refresh_token",
    });
    const next = { ...t, token: r.access_token, refreshedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + r.expires_in * 1000).toISOString() };
    await writeConfigJson(TOKEN_FILE, next);
    return next;
  } catch (e) {
    console.error("[instagram] no se pudo renovar el token:", (e as Error).message);
    return t;
  }
}

// --- Cola de publicaciones ---------------------------------------------------------------

export async function getInstagramQueue() {
  return readConfigJson<IgPublication[]>(QUEUE_FILE, []);
}

/** Lee la cola actual, cambia una publicación y guarda (sin pisar cambios hechos entretanto en otras) */
export async function updatePublication(id: string, change: (p: IgPublication) => void) {
  const queue = await getInstagramQueue();
  const p = queue.find((x) => x.id === id);
  if (!p) return null;
  change(p);
  p.updatedAt = new Date().toISOString();
  await writeConfigJson(QUEUE_FILE, queue);
  return p;
}

export async function addPublication(p: IgPublication) {
  const queue = await getInstagramQueue();
  queue.push(p);
  // Se conservan todas las pendientes y las últimas terminadas
  const done = queue.filter((x) => x.status === "publicada" || x.status === "cancelada");
  const drop = new Set(done.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(KEEP_FINISHED).map((x) => x.id));
  await writeConfigJson(QUEUE_FILE, queue.filter((x) => !drop.has(x.id)));
}

/** Valida tipo y cantidad de archivos según el formato */
export function validateMedia(kind: IgKind, media: IgMedia[]): string | null {
  if (!media.length) return "Agrega al menos una foto o video.";
  if (kind === "reel" && (media.length !== 1 || media[0].type !== "video")) return "Un reel lleva exactamente un video.";
  if (kind === "feed" && media.length > 20) return "Un carrusel admite como máximo 20 fotos o videos.";
  if (kind === "historia" && media.length > 10) return "Programa como máximo 10 historias a la vez.";
  return null;
}

// --- Publicación por pasos ------------------------------------------------------------------

const CAPTION = (p: IgPublication) => p.caption.trim();


async function containerStatus(id: string, token: string) {
  const r = await ig<{ status_code?: string; status?: string }>("GET", `/${id}`, token, { fields: "status_code,status" });
  return { code: r.status_code ?? "IN_PROGRESS", detail: r.status ?? "" };
}

/** "listo" | "esperando" | mensaje de error */
async function allFinished(ids: string[], token: string) {
  for (const id of ids) {
    const s = await containerStatus(id, token);
    if (s.code === "ERROR" || s.code === "EXPIRED") return `Instagram no pudo procesar un archivo (${s.code}${s.detail ? `: ${s.detail}` : ""}). Revisa el formato del video o la foto.`;
    if (s.code !== "FINISHED" && s.code !== "PUBLISHED") return "esperando";
  }
  return "listo";
}

function mediaParams(m: IgMedia): Record<string, string> {
  return m.type === "image" ? { image_url: m.url } : { video_url: m.url };
}

async function createContainers(p: IgPublication, t: TokenStore) {
  const make = (params: Record<string, string>) => ig<{ id: string }>("POST", `/${t.userId}/media`, t.token, params).then((r) => r.id);
  if (p.kind === "historia") {
    const ids: string[] = [];
    for (const m of p.media) ids.push(await make({ media_type: "STORIES", ...mediaParams(m) }));
    return { containers: ids };
  }
  if (p.kind === "reel" || (p.media.length === 1 && p.media[0].type === "video")) {
    return { containers: [await make({ media_type: "REELS", video_url: p.media[0].url, caption: CAPTION(p), share_to_feed: "true" })] };
  }
  if (p.media.length === 1) return { containers: [await make({ image_url: p.media[0].url, caption: CAPTION(p) })] };
  // Carrusel: primero cada elemento; el contenedor del carrusel se crea cuando todos están listos
  const children: string[] = [];
  for (const m of p.media) {
    children.push(await make(m.type === "image" ? { is_carousel_item: "true", image_url: m.url } : { is_carousel_item: "true", media_type: "VIDEO", video_url: m.url }));
  }
  return { children };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Avanza una publicación lo más posible. Espera hasta `budgetMs` a que Instagram procese;
 * si no alcanza, queda en "procesando" y la siguiente pasada continúa.
 */
async function advance(id: string, t: TokenStore, budgetMs: number): Promise<IgPublication | null> {
  const deadline = Date.now() + budgetMs;
  // Toma la publicación: evita que la tarea periódica y "Publicar ahora" la procesen a la vez
  const lock = new Date(Date.now() + LOCK_MS).toISOString();
  const taken = await updatePublication(id, (x) => {
    if (x.lockUntil && new Date(x.lockUntil) > new Date()) return;
    if (x.status !== "programada" && x.status !== "procesando") return;
    x.lockUntil = lock;
  });
  if (!taken || taken.lockUntil !== lock) return taken;
  let p: IgPublication = taken;

  const save = async (change: (x: IgPublication) => void) => {
    p = (await updatePublication(id, change)) ?? p;
    return p;
  };
  const release = () => save((x) => (x.lockUntil = null));
  const fail = async (message: string) => {
    await save((x) => {
      x.status = "error";
      x.error = message;
      x.lockUntil = null;
    });
    await logEvent("instagram_error", "instagram", null, { publicacion: id, error: message.slice(0, 300) });
    return p;
  };
  /** Espera a que Instagram termine de procesar; false si se acabó el tiempo de esta pasada */
  const waitFinished = async (ids: string[]) => {
    for (;;) {
      const s = await allFinished(ids, t.token);
      if (s === "listo") return true;
      if (s !== "esperando") throw new Error(s);
      if (Date.now() + 5000 > deadline) return false;
      await wait(4000);
    }
  };

  try {
    await save((x) => ((x.status = "procesando"), (x.error = null)));
    // Contenedores vencidos (más de un día procesando): se crean de nuevo
    if (p.containersAt && Date.now() - new Date(p.containersAt).getTime() > CONTAINER_TTL_MS && !p.published?.some(Boolean)) {
      await save((x) => ((x.children = undefined), (x.containers = undefined), (x.containersAt = undefined), (x.published = undefined)));
    }

    // 1. Contenedores
    if (!p.containers && !p.children) {
      const created = await createContainers(p, t);
      await save((x) => Object.assign(x, created, { containersAt: new Date().toISOString(), published: created.containers?.map(() => null) }));
    }
    // 2. Carrusel: con todos los elementos listos se crea el contenedor principal
    if (p.children && !p.containers) {
      if (!(await waitFinished(p.children))) return await release();
      const parent = await ig<{ id: string }>("POST", `/${t.userId}/media`, t.token, { media_type: "CAROUSEL", children: p.children.join(","), caption: CAPTION(p) });
      await save((x) => ((x.containers = [parent.id]), (x.published = [null])));
    }
    const containers = p.containers ?? [];
    // 3. Esperar que Instagram procese
    if (!(await waitFinished(containers.filter((_, i) => !p.published?.[i])))) return await release();
    // 4. Publicar (las historias, de a una)
    for (let i = 0; i < containers.length; i++) {
      if (p.published?.[i]) continue;
      await save((x) => (x.publishing = i));
      const r = await ig<{ id: string }>("POST", `/${t.userId}/media_publish`, t.token, { creation_id: containers[i] });
      await save((x) => {
        x.published = x.published ?? containers.map(() => null);
        x.published[i] = r.id;
        x.publishing = null;
      });
    }
    // 5. Enlaces, limpieza y registro
    const permalinks: string[] = [];
    for (const mediaId of p.published ?? []) {
      if (!mediaId) continue;
      const link = await ig<{ permalink?: string }>("GET", `/${mediaId}`, t.token, { fields: "permalink" })
        .then((r) => r.permalink)
        .catch(() => undefined);
      if (link) permalinks.push(link);
    }
    await save((x) => {
      x.status = "publicada";
      x.publishedAt = new Date().toISOString();
      x.permalinks = permalinks;
      x.error = null;
      x.lockUntil = null;
    });
    await removeMedia(p.media);
    if (p.source) await markPlanPost(p.source).catch((e) => console.error("[instagram] plan:", e));
    await logEvent("instagram_publicado", "instagram", null, { publicacion: id, tipo: p.kind, archivos: p.media.length, enlace: permalinks[0] ?? null });
    return p;
  } catch (e) {
    const message = (e as Error).message;
    // Si falló justo al publicar, puede que Instagram sí lo haya publicado: no se reintenta solo
    if (typeof p.publishing === "number") {
      return fail(`Falló al publicar: ${message}. Revisa Instagram antes de reintentar, porque podría haberse publicado.`);
    }
    return fail(message);
  }
}

async function markPlanPost(source: { runId: string; index: number }) {
  const runs = await getMarketingRuns();
  const post = runs.find((r) => r.id === source.runId)?.posts[source.index];
  if (!post) return;
  post.status = "publicado";
  await saveMarketingRuns(runs);
}

export async function removeMedia(media: IgMedia[]) {
  if (!media.length) return;
  await createAdminClient().storage.from(MEDIA_BUCKET).remove(media.map((m) => m.path)).catch(() => undefined);
}

/** Publica ya una publicación (botón del admin). Espera hasta ~4 minutos a que Instagram procese. */
export async function publishNow(id: string) {
  const t = await getTokenStore();
  if (!t) throw new Error("Instagram no está conectado.");
  await updatePublication(id, (x) => {
    if (x.status === "error" || x.status === "programada") {
      x.status = "programada";
      x.scheduledAt = new Date().toISOString();
      x.error = null;
      x.lockUntil = null;
      x.publishing = null;
      // Sin nada publicado todavía, un reintento crea los contenedores de nuevo
      if (!x.published?.some(Boolean)) {
        x.children = undefined;
        x.containers = undefined;
        x.containersAt = undefined;
        x.published = undefined;
      }
    }
  });
  return advance(id, t, 230_000);
}

/** Tarea periódica: publica lo que ya toca, renueva el token y borra archivos huérfanos */
export async function publishDueInstagram(now = new Date()) {
  let t = await getTokenStore();
  if (!t) return null;
  t = await refreshTokenIfNeeded(t);
  const queue = await getInstagramQueue();
  const due = queue.filter((p) => (p.status === "programada" && new Date(p.scheduledAt) <= now) || p.status === "procesando");
  let published = 0;
  for (const p of due.slice(0, 3)) {
    const r = await advance(p.id, t, 20_000);
    if (r?.status === "publicada") published++;
  }
  // Una vez al día (a las 4 de la mañana): archivos subidos que nadie usa
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour === 4 && now.getMinutes() < 5) await removeOrphans(queue).catch((e) => console.error("[instagram] limpieza:", e));
  return { due: due.length, published };
}

async function removeOrphans(queue: IgPublication[]) {
  const db = createAdminClient();
  const used = new Set(queue.filter((p) => p.status !== "publicada" && p.status !== "cancelada").flatMap((p) => p.media.map((m) => m.path)));
  const { data } = await db.storage.from(MEDIA_BUCKET).list("media", { limit: 1000 });
  const old = (data ?? []).filter((f) => !used.has(`media/${f.name}`) && Date.now() - new Date(f.created_at ?? 0).getTime() > 2 * 86400_000);
  if (old.length) await db.storage.from(MEDIA_BUCKET).remove(old.map((f) => `media/${f.name}`));
}

/** URLs firmadas para que el navegador suba los archivos directo a Supabase (sin pasar por Vercel) */
export async function createUploadTargets(files: { type: IgMedia["type"]; contentType: string }[]) {
  const db = createAdminClient();
  const exists = await db.storage.getBucket(MEDIA_BUCKET);
  if (exists.error) {
    const { error } = await db.storage.createBucket(MEDIA_BUCKET, {
      public: true,
      fileSizeLimit: MAX_MEDIA_BYTES,
      allowedMimeTypes: ["image/jpeg", "video/mp4", "video/quicktime"],
    });
    if (error && !/already exists/i.test(error.message)) throw new Error(`No se pudo crear el espacio de archivos: ${error.message}`);
  }
  return Promise.all(
    files.map(async ({ type, contentType }) => {
      const ext = type === "image" ? "jpg" : contentType === "video/quicktime" ? "mov" : "mp4";
      const path = `media/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await db.storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw new Error(`No se pudo preparar la subida: ${error?.message}`);
      return { path, signedUrl: data.signedUrl, url: db.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl, type };
    }),
  );
}
