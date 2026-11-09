"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { slugify } from "@/lib/slug";
import { setProductCost } from "@/lib/costs";
import type { ActionResult } from "@/components/admin/action-form";

const TYPES = ["cafe", "accesorio", "promocion", "preparado"] as const;
const IMAGE_BUCKET = "productos";
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const optStr = (f: FormData, k: string) => str(f, k) || null;
const int = (f: FormData, k: string) => {
  const v = str(f, k);
  if (!v) return null;
  const n = Number(v.replace(/[.\s$]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};
const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};

async function uploadImages(files: File[], slug: string) {
  const db = createAdminClient();
  const urls: string[] = [];
  for (const file of files) {
    if (!file.size) continue;
    if (!file.type.startsWith("image/")) throw new Error(`${file.name} no es una imagen.`);
    if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} pesa más de 3,5 MB. Redúcela antes de subirla.`);
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${slug}/${crypto.randomUUID()}.${ext}`;
    let { error } = await db.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error && /not found/i.test(error.message)) {
      await db.storage.createBucket(IMAGE_BUCKET, { public: true });
      ({ error } = await db.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" }));
    }
    if (error) throw new Error(`No se pudo subir ${file.name}: ${error.message}`);
    urls.push(db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl);
  }
  return urls;
}

export async function saveProduct(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff(["admin"]);
  const db = createAdminClient();
  const id = optStr(form, "id");

  const type = str(form, "type") as (typeof TYPES)[number];
  if (!TYPES.includes(type)) return { error: "Elige el tipo de producto." };
  const name = str(form, "name");
  if (name.length < 2) return { error: "El nombre es obligatorio." };
  const slug = slugify(str(form, "slug") || name);
  if (!slug) return { error: "La dirección web (slug) no es válida." };
  const price = int(form, "price_clp");
  if (price === null || Number.isNaN(price) || price < 0) return { error: "Ingresa un precio válido en pesos." };

  const isBundle = type === "promocion";
  // Costo unitario neto (las promociones lo calculan desde sus productos)
  const cost = isBundle ? null : int(form, "cost_clp");
  if (cost !== null && (Number.isNaN(cost) || cost < 0)) return { error: "El costo debe ser un número en pesos." };
  const trackStock = isBundle ? false : form.get("track_stock") === "on";
  const lowStock = int(form, "low_stock_threshold") ?? 3;
  const dims = { weight_g: num(form, "weight_g"), length_cm: num(form, "length_cm"), width_cm: num(form, "width_cm"), height_cm: num(form, "height_cm") };
  if (Object.values(dims).some((v) => Number.isNaN(v) || (v !== null && v <= 0))) return { error: "Peso y medidas deben ser números mayores que cero." };

  // Contenido de la promoción
  let bundle: { product_id: string; quantity: number }[] = [];
  if (isBundle) {
    try {
      bundle = (JSON.parse(str(form, "bundle") || "[]") as { product_id: string; quantity: number }[]).filter((b) => b.product_id && b.quantity > 0);
    } catch {
      return { error: "No se pudo leer el contenido de la promoción." };
    }
    if (bundle.length < 1) return { error: "Una promoción debe incluir al menos un producto." };
    if (new Set(bundle.map((b) => b.product_id)).size !== bundle.length) return { error: "Hay productos repetidos en la promoción." };
    if (id && bundle.some((b) => b.product_id === id)) return { error: "Una promoción no puede incluirse a sí misma." };
  }

  // Fotos
  let images: string[] = [];
  try {
    const keep = form.getAll("keep_image").map(String);
    const uploaded = await uploadImages(form.getAll("images").filter((f): f is File => f instanceof File), slug);
    images = [...keep, ...uploaded];
  } catch (e) {
    return { error: (e as Error).message };
  }

  const row = {
    name,
    slug,
    type,
    sku: optStr(form, "sku"),
    category_id: optStr(form, "category_id"),
    description: optStr(form, "description"),
    origin: type === "cafe" ? optStr(form, "origin") : null,
    process: type === "cafe" ? optStr(form, "process") : null,
    variety: type === "cafe" ? optStr(form, "variety") : null,
    tasting_notes: type === "cafe" ? optStr(form, "tasting_notes") : null,
    price_clp: price,
    track_stock: trackStock,
    low_stock_threshold: lowStock,
    ...dims,
    visible_online: type === "preparado" ? false : form.get("visible_online") === "on",
    active: form.get("active") === "on",
    image_urls: images,
    updated_at: new Date().toISOString(),
  };

  let productId = id;
  if (id) {
    const { error } = await db.from("products").update(row).eq("id", id);
    if (error) return { error: error.code === "23505" ? "Ya existe un producto con esa dirección web o SKU." : error.message };
  } else {
    const initialStock = trackStock ? int(form, "stock") ?? 0 : 0;
    if (Number.isNaN(initialStock) || initialStock < 0) return { error: "El stock inicial no es válido." };
    const { data, error } = await db.from("products").insert({ ...row, stock: initialStock }).select("id").single();
    if (error) return { error: error.code === "23505" ? "Ya existe un producto con esa dirección web o SKU." : error.message };
    productId = data.id;
    if (initialStock > 0) {
      await db.from("stock_movements").insert({ product_id: productId, delta: initialStock, reason: "ajuste", note: "Stock inicial", created_by: staff.userId });
    }
  }

  if (isBundle) {
    await db.from("bundle_items").delete().eq("bundle_id", productId);
    const { error } = await db.from("bundle_items").insert(bundle.map((b) => ({ bundle_id: productId, ...b })));
    if (error) return { error: `No se pudo guardar el contenido de la promoción: ${error.message}` };
  }

  try {
    await setProductCost(productId!, cost);
  } catch (e) {
    return { error: `El producto se guardó, pero no su costo: ${(e as Error).message}` };
  }

  await logEvent(id ? "producto_editado" : "producto_creado", "product", productId, { nombre: name, precio: price, costo: cost, por: staff.email });
  updateTag("catalog");

  if (!id) redirect(`/admin/productos/${productId}?creado=1`);
  refresh();
  return { ok: "Cambios guardados." };
}
