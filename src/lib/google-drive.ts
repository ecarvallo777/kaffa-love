import "server-only";
import { createSign } from "node:crypto";

/*
 * Lectura de una carpeta de Google Drive con una cuenta de servicio.
 *   GOOGLE_SERVICE_ACCOUNT_JSON  contenido completo del archivo JSON de la clave
 *   DRIVE_FACTURAS_FOLDER        id o enlace de la carpeta (compartida con la cuenta de servicio)
 * Solo pide permiso de lectura (drive.readonly).
 */

type ServiceAccount = { client_email: string; private_key: string };

export type DriveFile = { id: string; name: string; mimeType: string; createdTime: string; size: number; webViewLink: string | null };

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.client_email || !sa.private_key) return null;
    return { client_email: sa.client_email, private_key: sa.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** Acepta el id de la carpeta o el enlace completo (…/folders/<id>) */
export function invoicesFolderId(): string | null {
  const v = process.env.DRIVE_FACTURAS_FOLDER?.trim();
  if (!v) return null;
  return /\/folders\/([\w-]+)/.exec(v)?.[1] ?? v;
}

export function driveConfigured() {
  return Boolean(serviceAccount() && invoicesFolderId());
}

export function driveServiceEmail() {
  return serviceAccount()?.client_email ?? null;
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const sa = serviceAccount();
  if (!sa) throw new Error("Falta configurar GOOGLE_SERVICE_ACCOUNT_JSON.");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(signature)}` }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google no aceptó la cuenta de servicio: ${json.error_description ?? res.status}`);
  cached = { token: json.access_token, exp: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** Archivos de la carpeta (sin subcarpetas ni papelera), del más antiguo al más nuevo */
export async function listInvoiceFiles(): Promise<DriveFile[]> {
  const folder = invoicesFolderId();
  if (!folder) throw new Error("Falta configurar DRIVE_FACTURAS_FOLDER.");
  const token = await accessToken();
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folder}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: "nextPageToken, files(id, name, mimeType, createdTime, size, webViewLink)",
      orderBy: "createdTime",
      pageSize: "200",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = (await res.json()) as {
      files?: { id: string; name: string; mimeType: string; createdTime: string; size?: string; webViewLink?: string }[];
      nextPageToken?: string;
      error?: { message: string };
    };
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "No se encontró la carpeta de Drive. Revisa el enlace y que esté compartida con la cuenta de servicio."
          : `Drive respondió con un error: ${json.error?.message ?? res.status}`,
      );
    }
    for (const f of json.files ?? []) {
      files.push({ id: f.id, name: f.name, mimeType: f.mimeType, createdTime: f.createdTime, size: Number(f.size ?? 0), webViewLink: f.webViewLink ?? null });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return files;
}

export async function downloadFile(id: string): Promise<Buffer> {
  const token = await accessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`No se pudo descargar el archivo de Drive (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}
