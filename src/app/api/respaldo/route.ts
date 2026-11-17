import { NextResponse, type NextRequest } from "next/server";
import { buildBackup } from "@/lib/backup";
import { logEvent } from "@/lib/events";

export const maxDuration = 120;

/**
 * Respaldo completo de la tienda en JSON (src/lib/backup.ts), con
 * Authorization: Bearer <BACKUP_SECRET>. Lo descarga cada semana el Apps Script
 * de Google Drive (scripts/respaldo/apps-script.gs).
 * Clave propia, distinta de CRON_SECRET: este archivo trae los datos de todos los clientes.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.BACKUP_SECRET;
  if (!secret || secret.length < 24 || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const backup = await buildBackup();
    const rows = Object.fromEntries(Object.entries(backup.tables).map(([t, r]) => [t, r.length]));
    await logEvent("respaldo_descargado", "backup", null, { filas: rows, config: Object.keys(backup.config).length });
    return NextResponse.json(backup, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[respaldo]", (e as Error).message);
    return NextResponse.json({ ok: false, error: "No se pudo generar el respaldo." }, { status: 500 });
  }
}
