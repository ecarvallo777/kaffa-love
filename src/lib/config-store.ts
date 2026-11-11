import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Archivos JSON privados en Supabase Storage (bucket "config").
 * Se usan para datos nuevos sin tocar el esquema de la base de datos.
 */

const BUCKET = "config";

export async function readConfigJson<T>(file: string, fallback: T): Promise<T> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(file);
  if (error || !data) return fallback;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return fallback;
  }
}

export async function writeConfigJson(file: string, value: unknown) {
  const db = createAdminClient();
  const body = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  let { error } = await db.storage.from(BUCKET).upload(file, body, { upsert: true });
  if (error && /not found/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: false });
    ({ error } = await db.storage.from(BUCKET).upload(file, body, { upsert: true }));
  }
  if (error) throw new Error(`No se pudo guardar ${file}: ${error.message}`);
}
