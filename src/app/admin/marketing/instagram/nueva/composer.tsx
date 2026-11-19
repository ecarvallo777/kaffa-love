"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMessage, type ActionResult } from "@/components/admin/action-form";
import { Card, Field, btn, field, textarea } from "@/components/admin/ui";
import { createInstagramPublication, prepareInstagramUploads } from "../../actions";
import { CopyButton } from "../../copy-button";

type Kind = "feed" | "reel" | "historia";
type Item = { key: string; type: "image" | "video"; source: File | string; preview: string; name: string; duration?: number };
type Product = { slug: string; name: string; images: string[] };

const MAX_BYTES = 50 * 1024 * 1024;
const RATIOS = { "4:5": 4 / 5, "1:1": 1, "1.91:1": 1.91 } as const;
const STORY_BG = "#f4efe6";

const KINDS: { value: Kind; label: string; hint: string }[] = [
  { value: "feed", label: "Publicación", hint: "Una foto, un video o un carrusel de hasta 20." },
  { value: "reel", label: "Reel", hint: "Un video vertical (9:16), de 3 segundos a 15 minutos." },
  { value: "historia", label: "Historias", hint: "Cada foto o video es una historia (videos de hasta 60 segundos)." },
];

/** Foto → JPG para Instagram: recortada al formato (publicación) o centrada en 9:16 (historia) */
async function toJpeg(source: File | string, mode: { ratio: number } | "historia"): Promise<Blob> {
  const blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`No se pudo leer ${typeof source === "string" ? "una foto del catálogo" : source.name}. Conviértela a JPG o PNG.`);
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  if (mode === "historia") {
    canvas.width = 1080;
    canvas.height = 1920;
    ctx.fillStyle = STORY_BG;
    ctx.fillRect(0, 0, 1080, 1920);
    const scale = Math.min(1080 / bmp.width, 1920 / bmp.height);
    const w = bmp.width * scale;
    const h = bmp.height * scale;
    ctx.drawImage(bmp, (1080 - w) / 2, (1920 - h) / 2, w, h);
  } else {
    const r = mode.ratio;
    let sw = bmp.width;
    let sh = bmp.height;
    if (sw / sh > r) sw = sh * r;
    else sh = sw / r;
    const outW = Math.round(Math.min(1440, sw));
    canvas.width = outW;
    canvas.height = Math.round(outW / r);
    ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height);
  }
  bmp.close();
  for (const q of [0.9, 0.8, 0.7]) {
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (out && out.size < 8 * 1024 * 1024) return out;
  }
  throw new Error("Una foto quedó demasiado pesada para Instagram.");
}

function upload(url: string, body: Blob, contentType: string, onProgress: (f: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", contentType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`La subida falló (${xhr.status}): ${xhr.responseText.slice(0, 120)}`)));
    xhr.onerror = () => reject(new Error("Se cortó la conexión mientras se subía un archivo."));
    xhr.send(body);
  });
}

function videoDuration(file: File) {
  return new Promise<number | undefined>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => resolve(Number.isFinite(v.duration) ? v.duration : undefined);
    v.onerror = () => resolve(undefined);
    v.src = URL.createObjectURL(file);
  });
}

export function InstagramComposer({
  username,
  initial,
  products,
}: {
  username: string;
  initial: { kind: Kind; caption: string; photoIdea: string | null; link: string | null; scheduledAt: string; source: { runId: string; index: number } | null };
  products: Product[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initial.kind);
  const [items, setItems] = useState<Item[]>([]);
  const [ratio, setRatio] = useState<keyof typeof RATIOS>("4:5");
  const [caption, setCaption] = useState(initial.caption);
  const [when, setWhen] = useState<"programar" | "ahora">("programar");
  const [scheduledAt, setScheduledAt] = useState(initial.scheduledAt);
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState<ActionResult>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Libera las vistas previas al salir
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach((i) => typeof i.source !== "string" && URL.revokeObjectURL(i.preview)), []);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    const added: Item[] = [];
    const problems: string[] = [];
    for (const f of Array.from(files)) {
      const isVideo = f.type.startsWith("video/");
      if (isVideo && !["video/mp4", "video/quicktime"].includes(f.type)) problems.push(`${f.name}: el video debe ser MP4 o MOV.`);
      else if (isVideo && f.size > MAX_BYTES) problems.push(`${f.name}: pesa más de 50 MB. Expórtalo en 1080p o recórtalo.`);
      else if (!isVideo && !f.type.startsWith("image/")) problems.push(`${f.name}: no es una foto ni un video.`);
      else added.push({ key: crypto.randomUUID(), type: isVideo ? "video" : "image", source: f, preview: URL.createObjectURL(f), name: f.name, duration: isVideo ? await videoDuration(f) : undefined });
    }
    setItems((cur) => [...cur, ...added]);
    setState(problems.length ? { error: problems.join(" ") } : null);
    if (fileInput.current) fileInput.current.value = "";
  }

  const addCatalog = (url: string, name: string) =>
    setItems((cur) => [...cur, { key: crypto.randomUUID(), type: "image", source: url, preview: url, name }]);

  const move = (i: number, d: -1 | 1) =>
    setItems((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const remove = (i: number) =>
    setItems((cur) => {
      const it = cur[i];
      if (typeof it.source !== "string") URL.revokeObjectURL(it.preview);
      return cur.filter((_, k) => k !== i);
    });

  function check(): string | null {
    if (!items.length) return "Agrega al menos una foto o video.";
    if (kind === "reel" && (items.length !== 1 || items[0].type !== "video")) return "Un reel lleva exactamente un video.";
    if (kind === "feed" && items.length > 20) return "Un carrusel admite como máximo 20 fotos o videos.";
    if (kind === "historia" && items.length > 10) return "Programa como máximo 10 historias a la vez.";
    const short = items.find((i) => i.type === "video" && i.duration !== undefined && i.duration < 3);
    if (short) return `${short.name} dura menos de 3 segundos (el mínimo de Instagram).`;
    const long = items.find((i) => i.type === "video" && i.duration !== undefined && i.duration > (kind === "historia" ? 60 : 900));
    if (long) return `${long.name} es muy largo: ${kind === "historia" ? "una historia dura hasta 60 segundos" : "el máximo es 15 minutos"}.`;
    if (kind !== "historia" && caption.length > 2200) return "El texto tiene más de 2.200 caracteres.";
    if (when === "programar" && !scheduledAt) return "Elige la fecha y hora.";
    return null;
  }

  async function submit() {
    const problem = check();
    if (problem) return setState({ error: problem });
    if (when === "ahora" && !window.confirm(`¿Publicar ahora en @${username}?`)) return;
    setState(null);
    try {
      // 1. Fotos a JPG con el formato de Instagram
      setBusy("Preparando las fotos…");
      const bodies: { blob: Blob; contentType: string; type: Item["type"] }[] = [];
      for (const it of items) {
        if (it.type === "video") bodies.push({ blob: it.source as File, contentType: (it.source as File).type, type: "video" });
        else bodies.push({ blob: await toJpeg(it.source, kind === "historia" ? "historia" : { ratio: RATIOS[ratio] }), contentType: "image/jpeg", type: "image" });
      }
      // 2. Subida directa a Supabase
      const targets = await prepareInstagramUploads(bodies.map((b) => ({ type: b.type, contentType: b.contentType })));
      const total = bodies.reduce((s, b) => s + b.blob.size, 0);
      let done = 0;
      for (let i = 0; i < bodies.length; i++) {
        const before = done;
        await upload(targets[i].signedUrl, bodies[i].blob, bodies[i].contentType, (f) =>
          setBusy(`Subiendo ${i + 1} de ${bodies.length}… ${Math.round(((before + f * bodies[i].blob.size) / total) * 100)} %`),
        );
        done += bodies[i].blob.size;
      }
      // 3. Programar o publicar
      setBusy(when === "ahora" ? "Publicando en Instagram… (con video puede tardar unos minutos)" : "Programando…");
      const result = await createInstagramPublication({
        kind,
        caption,
        media: targets.map((t) => ({ path: t.path, url: t.url, type: t.type })),
        scheduledAt: when === "ahora" ? "" : scheduledAt,
        source: initial.source,
      });
      setState(result);
      if (result?.ok) {
        items.forEach((i) => typeof i.source !== "string" && URL.revokeObjectURL(i.preview));
        setItems([]);
        router.push(`/admin/marketing?ig=${encodeURIComponent(result.ok)}#instagram`);
      }
    } catch (e) {
      setState({ error: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const aspect = kind === "historia" ? "aspect-[9/16]" : kind === "reel" ? "aspect-[9/16]" : ratio === "4:5" ? "aspect-[4/5]" : ratio === "1:1" ? "aspect-square" : "aspect-[1.91/1]";

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <Card title="Formato">
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => (
              <label key={k.value} className={`cursor-pointer rounded-xl border p-3 text-sm ${kind === k.value ? "border-ink bg-white" : "border-line bg-white/50"}`}>
                <input type="radio" name="kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="sr-only" />
                <span className="font-medium">{k.label}</span>
                <span className="mt-1 block text-xs text-ink-mute">{k.hint}</span>
              </label>
            ))}
          </div>
          {kind === "historia" && (
            <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-soft">
              Instagram no permite agregar el sticker de enlace a historias publicadas desde fuera de la app. Si la historia necesita el enlace a la tienda, publícala desde el celular.
            </p>
          )}
        </Card>

        <Card title={`Fotos y videos (${items.length})`}>
          {initial.photoIdea && (
            <p className="mb-4 rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-soft">
              <span className="font-medium text-ink">Idea del plan: </span>
              {initial.photoIdea}
            </p>
          )}
          {items.length > 0 && (
            <ol className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((it, i) => (
                <li key={it.key} className="overflow-hidden rounded-xl border border-line bg-white">
                  <div className={`relative ${aspect} bg-paper-2`}>
                    {it.type === "video" ? (
                      <video src={it.preview} className="absolute inset-0 size-full object-cover" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.preview} alt="" className={`absolute inset-0 size-full ${kind === "historia" ? "object-contain" : "object-cover"}`} />
                    )}
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-xs text-paper">
                      {i + 1}
                      {it.type === "video" ? ` · video${it.duration ? ` ${Math.round(it.duration)} s` : ""}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1.5">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30" aria-label="Mover antes">←</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="grid size-8 place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30" aria-label="Mover después">→</button>
                    </div>
                    <button type="button" onClick={() => remove(i)} className="grid size-8 place-items-center rounded-full text-accent-deep hover:bg-accent/10" aria-label="Quitar">✕</button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={btn.primary} onClick={() => fileInput.current?.click()}>Subir fotos o videos</button>
            <input ref={fileInput} type="file" multiple accept="image/*,video/mp4,video/quicktime" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <span className="text-xs text-ink-mute">Fotos de cualquier tamaño (se ajustan solas) · videos MP4 o MOV de hasta 50 MB</span>
          </div>
          {kind === "feed" && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-soft">Formato de las fotos:</span>
              {(Object.keys(RATIOS) as (keyof typeof RATIOS)[]).map((r) => (
                <button key={r} type="button" onClick={() => setRatio(r)} className={`rounded-full border px-3 py-1 ${ratio === r ? "border-ink bg-ink text-paper" : "border-line bg-white"}`}>
                  {r === "4:5" ? "Vertical 4:5" : r === "1:1" ? "Cuadrada 1:1" : "Horizontal"}
                </button>
              ))}
            </div>
          )}
          {products.length > 0 && kind !== "reel" && (
            <details className="mt-5 rounded-xl border border-line bg-white/60 p-3">
              <summary className="cursor-pointer text-sm font-medium">Agregar fotos del catálogo</summary>
              <div className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1">
                {products.map((p) => (
                  <div key={p.slug}>
                    <p className="mb-1 text-xs text-ink-mute">{p.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {p.images.map((url) => (
                        <button key={url} type="button" onClick={() => addCatalog(url, p.name)} className="overflow-hidden rounded-lg border border-line hover:border-ink" title={`Agregar foto de ${p.name}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={p.name} className="size-16 object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </Card>

        {kind !== "historia" && (
          <Card title="Texto">
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={10} className={textarea} />
            <p className={`mt-1 text-xs ${caption.length > 2200 ? "text-accent-deep" : "text-ink-mute"}`}>{caption.length} de 2.200 caracteres · los enlaces del texto no son clicables en Instagram</p>
            {initial.link && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
                <span className="truncate">Enlace con etiqueta para la bio: {initial.link}</span>
                <CopyButton text={initial.link} label="Copiar enlace" />
              </div>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <Card title="¿Cuándo?">
          <div className="space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={when === "programar"} onChange={() => setWhen("programar")} /> Programar
            </label>
            {when === "programar" && (
              <Field label="Fecha y hora (Chile)" hint="Se publica sola dentro de los 5 minutos siguientes.">
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={field} />
              </Field>
            )}
            <label className="flex items-center gap-2">
              <input type="radio" checked={when === "ahora"} onChange={() => setWhen("ahora")} /> Publicar ahora
            </label>
          </div>
          <button type="button" onClick={submit} disabled={!!busy} className={`${btn.primary} mt-5 w-full`}>
            {busy ?? (when === "ahora" ? `Publicar en @${username}` : "Programar publicación")}
          </button>
          <ActionMessage state={state} />
        </Card>
      </div>
    </div>
  );
}
