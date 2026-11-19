import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Archivos JSON privados en Supabase Storage (bucket "config").
 * Se usan para datos nuevos sin tocar el esquema de la base de datos.
 *
 * Importante: "el archivo no existe" y "no se pudo leer" son cosas distintas. Si una lectura
 * fallida se tomara como archivo vacío, el siguiente guardado escribiría encima solo el dato
 * nuevo y borraría todo lo demás (pasó el 13-11-2026 con las facturas de compras).
 */

const BUCKET = "config";

const isNotFound = (e: { message?: string; statusCode?: string | number }) => String(e.statusCode) === "404" || /not.?found/i.test(e.message ?? "");

/**
 * Texto de un archivo de un bucket privado; null solo si el archivo no existe.
 * Reintenta los errores pasajeros y, si persisten, lanza el error (nunca devuelve "vacío" por un error).
 */
export async function downloadText(bucket: string, file: string): Promise<string | null> {
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 400 * attempt));
    const { data, error } = await createAdminClient().storage.from(bucket).download(file);
    if (!error && data) return data.text();
    if (error && isNotFound(error as { message?: string; statusCode?: string })) return null;
    last = error?.message ?? "respuesta vacía";
  }
  throw new Error(`No se pudo leer ${bucket}/${file}: ${last}`);
}

export async function readConfigJson<T>(file: string, fallback: T): Promise<T> {
  const text = await downloadText(BUCKET, file);
  if (text === null) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Un archivo dañado no se reemplaza en silencio por el valor por defecto
    throw new Error(`El archivo ${BUCKET}/${file} está dañado (no es JSON válido).`);
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
