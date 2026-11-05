// Acceso a Supabase para verificar resultados de las pruebas (usa .env.local)
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

export function loadEnv(file = ".env.local") {
  if (!fs.existsSync(file)) return {};
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

export function adminDb() {
  const env = { ...loadEnv(), ...process.env };
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false },
  });
}

export async function stockOf(db, slugs) {
  const { data, error } = await db.from("products").select("slug, stock").in("slug", slugs);
  if (error) throw new Error(error.message);
  return Object.fromEntries(data.map((p) => [p.slug, p.stock]));
}
