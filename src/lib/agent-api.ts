import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/*
 * API de solo lectura para agentes y otros proyectos (PRD §10).
 * Autenticación: cabecera  Authorization: Bearer <AGENT_API_KEY>
 * Nunca entrega correos, teléfonos, nombres ni direcciones exactas de clientes.
 */

export function authorizeAgent(request: NextRequest): NextResponse | null {
  const key = process.env.AGENT_API_KEY;
  if (!key) return NextResponse.json({ error: "API deshabilitada: falta AGENT_API_KEY" }, { status: 503 });
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  // Comparación en tiempo constante sobre hashes de igual largo
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(key).digest();
  if (!given || !timingSafeEqual(a, b)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return null;
}

export function dateRange(request: NextRequest, defaultDays = 30) {
  const sp = request.nextUrl.searchParams;
  const parse = (v: string | null) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  const hasta = parse(sp.get("hasta")) ?? new Date().toISOString();
  const desde = parse(sp.get("desde")) ?? new Date(Date.parse(hasta) - defaultDays * 86400_000).toISOString();
  const limite = Math.min(Math.max(Number(sp.get("limite")) || 500, 1), 2000);
  return { desde, hasta, limite };
}

/** Quita datos personales del contenido de un evento */
export function scrubEventData(data: Record<string, unknown>) {
  const rest = { ...data };
  delete rest.por;
  delete rest.email;
  return rest;
}
