"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { logEvent } from "@/lib/events";
import { slugify } from "@/lib/slug";
import { getMarketingRuns, runMarketingAgent, saveMarketingRuns, type PostStatus } from "@/lib/marketing/agent";
import { getGuidesFresh, saveGuides, type GuideStatus } from "@/lib/guides";
import type { ActionResult } from "@/components/admin/action-form";

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
