// Instagram simulado para scripts/e2e/instagram.mjs: imita la API de publicación
// (/me, /<id>/media, estado de contenedores, /media_publish, permalink), descarga
// cada archivo como lo haría Instagram y valida JPG, tamaño y formato de las fotos.
import http from "node:http";

export const IG_USER = "17890000000000001";
export const IG_USERNAME = "kaffa_prueba";

/** Ancho y alto de un JPG (marcador SOF) */
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

export function startInstagramSimulado(port = 4599) {
  const containers = new Map();
  const media = new Map();
  const log = [];
  let n = 0;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let body = "";
    for await (const c of req) body += c;
    const params = Object.fromEntries(new URLSearchParams(req.method === "POST" ? body : url.search));
    const send = (status, json) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(json));
    };
    const fail = (message) => (log.push({ error: message }), send(400, { error: { message, code: 100 } }));
    const token = params.access_token ?? "";
    const appToken = token === "123456|secreto-de-prueba";
    if (!token.startsWith("IGAA") && !token.startsWith("EAA") && !appToken) return send(400, { error: { message: "Invalid OAuth access token - Cannot parse access token", code: 190 } });
    const parts = url.pathname.split("/").filter(Boolean);

    // Tokens de Facebook (EAA…): el de la app dura 1 hora; con la clave secreta se cambia por uno de 60 días
    // Los de «Unified login» (EAAunif…) no se pueden consultar con el mismo token ni entregan /app
    if (token.startsWith("EAAunif") && (parts[0] === "debug_token" || parts[0] === "app")) return send(400, { error: { message: "(#100) Missing permissions", code: 100 } });
    if (token.startsWith("EAA") || appToken) {
      // Unified login: sin permiso de páginas; la cuenta viene en granular_scopes
      const unified = (t) => t.startsWith("EAAunif") || t.startsWith("EAAlargoU");
      if (parts[0] === "debug_token") {
        const long = params.input_token.startsWith("EAAlargo");
        const expires_at = Math.floor(Date.now() / 1000) + (long ? 5184000 : 3600);
        if (unified(params.input_token)) {
          return send(200, {
            data: {
              app_id: "123456",
              is_valid: true,
              expires_at,
              scopes: ["instagram_basic", "instagram_content_publish", "public_profile"],
              granular_scopes: [{ scope: "instagram_basic", target_ids: [IG_USER] }, { scope: "instagram_content_publish", target_ids: [IG_USER] }],
            },
          });
        }
        return send(200, { data: { app_id: "123456", is_valid: true, expires_at, scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"] } });
      }
      if (parts[0] === "oauth") {
        if (params.client_secret !== "secreto-de-prueba" || params.client_id !== "123456") return send(400, { error: { message: "Error validating client secret.", code: 1 } });
        return send(200, { access_token: (unified(params.fb_exchange_token) ? "EAAlargoU" : "EAAlargo") + "y".repeat(60), token_type: "bearer", expires_in: 5184000 });
      }
      if (parts[0] === "me" && parts[1] === "accounts") {
        if (unified(token)) return send(400, { error: { message: "(#100) Requires pages_show_list permission", code: 100 } });
        return send(200, { data: [{ name: "Kaffa Love", instagram_business_account: { id: IG_USER, username: IG_USERNAME } }] });
      }
      if (req.method === "GET" && parts[0] === IG_USER && parts.length === 1) return send(200, { id: IG_USER, username: IG_USERNAME });
    }

    if (req.method === "GET" && parts[0] === "me") return send(200, { data: [{ user_id: IG_USER, username: IG_USERNAME }] });

    if (req.method === "POST" && parts[0] === IG_USER && parts[1] === "media") {
      const entry = { id: `c${++n}`, params, polls: 0 };
      if (params.media_type === "CAROUSEL") {
        const kids = params.children.split(",");
        if (kids.length < 2 || kids.some((k) => !containers.has(k) || !containers.get(k).params.is_carousel_item)) return fail("children no válidos");
        if (kids.some((k) => containers.get(k).status() !== "FINISHED")) return fail("children sin procesar");
      } else {
        const src = params.image_url ?? params.video_url;
        if (!src) return fail("falta image_url o video_url");
        const r = await fetch(src);
        if (!r.ok) return fail(`no se pudo descargar ${src}: ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (params.image_url) {
          const size = jpegSize(buf);
          if (!size) return fail("la imagen no es JPG");
          if (buf.length > 8 * 1024 * 1024) return fail("imagen de más de 8 MB");
          const ratio = size.width / size.height;
          if (params.media_type !== "STORIES" && (ratio < 0.79 || ratio > 1.92)) return fail(`proporción no permitida: ${ratio.toFixed(2)}`);
          entry.size = size;
        }
        entry.bytes = buf.length;
      }
      // Los videos tardan un par de consultas en quedar listos
      entry.status = () => (params.video_url && entry.polls < 2 ? "IN_PROGRESS" : "FINISHED");
      containers.set(entry.id, entry);
      log.push({ create: entry.id, ...params, access_token: undefined, size: entry.size });
      return send(200, { id: entry.id });
    }

    if (req.method === "POST" && parts[0] === IG_USER && parts[1] === "media_publish") {
      const c = containers.get(params.creation_id);
      if (!c || c.status() !== "FINISHED") return fail("contenedor no listo");
      if (c.published) return fail("contenedor ya publicado");
      c.published = `m${++n}`;
      media.set(c.published, c);
      log.push({ publish: params.creation_id, media: c.published });
      return send(200, { id: c.published });
    }

    if (req.method === "GET" && parts.length === 1) {
      const c = containers.get(parts[0]);
      if (c) {
        c.polls++;
        return send(200, { status_code: c.published ? "PUBLISHED" : c.status(), id: c.id });
      }
      if (media.has(parts[0])) return send(200, { permalink: `https://www.instagram.com/p/${parts[0]}/`, id: parts[0] });
    }
    send(404, { error: { message: `ruta simulada desconocida: ${req.method} ${url.pathname}` } });
  });

  return new Promise((resolve) => server.listen(port, () => resolve({ log, close: () => server.close() })));
}
