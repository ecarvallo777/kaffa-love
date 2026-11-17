// Importa clientes (y sus direcciones) exportados desde PrestaShop.
//
//   node scripts/prestashop/importar-clientes.mjs clientes.csv [direcciones.csv] [--aplicar]
//
// Sin --aplicar solo muestra lo que haría (simulación). Ver README.md en esta carpeta.
import fs from "node:fs";
import { adminDb } from "../e2e/db.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--aplicar");
const [customersFile, addressesFile] = args.filter((a) => !a.startsWith("--"));
if (!customersFile) {
  console.error("Uso: node scripts/prestashop/importar-clientes.mjs clientes.csv [direcciones.csv] [--aplicar]");
  process.exit(1);
}

/** CSV con separador ; o , y comillas dobles (formato de exportación de PrestaShop) */
function parseCsv(file) {
  let text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const sep = (text.split("\n")[0].match(/;/g) ?? []).length >= (text.split("\n")[0].match(/,/g) ?? []).length ? ";" : ",";
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map((h) => h.trim().toLowerCase());
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

// Nombres de columna posibles según versión/idioma de PrestaShop
const pick = (row, ...keys) => keys.map((k) => row[k]).find((v) => v !== undefined && v !== "") ?? "";

// Mismos nombres que src/lib/chile.ts: el envío se calcula comparando el nombre exacto
const REGIONES = [
  "Arica y Parinacota", "Tarapacá", "Antofagasta", "Atacama", "Coquimbo", "Valparaíso",
  "Metropolitana de Santiago", "Libertador General Bernardo O'Higgins", "Maule", "Ñuble", "Biobío",
  "La Araucanía", "Los Ríos", "Los Lagos", "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
];
const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/^region (de |del )?/, "").trim();
/** PrestaShop guarda "METROPOLITANA DE SANTIAGO", "NUBLE", "ARAUCANIA"... */
function region(raw) {
  const p = plain(raw);
  if (!p) return "Sin región";
  return REGIONES.find((r) => plain(r) === p) ?? REGIONES.find((r) => plain(r).includes(p) || p.includes(plain(r))) ?? raw;
}

const customers = parseCsv(customersFile);
const addresses = addressesFile ? parseCsv(addressesFile) : [];
console.log(`${customers.length} clientes y ${addresses.length} direcciones leídos.`);

const db = adminDb();
let created = 0, updated = 0, skipped = 0, withConsent = 0, addrCount = 0;

for (const c of customers) {
  const email = pick(c, "email", "correo electrónico", "e-mail").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { skipped++; continue; }
  const name = [pick(c, "firstname", "nombre"), pick(c, "lastname", "apellido", "apellidos")].filter(Boolean).join(" ") || null;
  const active = pick(c, "active", "activo");
  if (active === "0") { skipped++; continue; }

  // El consentimiento solo se migra si PrestaShop registró la suscripción (con fecha)
  const newsletter = pick(c, "newsletter", "boletín", "boletin") === "1";
  const consentDate = pick(c, "newsletter_date_add", "fecha de suscripción al boletín");
  const consent = newsletter && consentDate && !consentDate.startsWith("0000") ? { marketing_consent: true, marketing_consent_at: new Date(consentDate).toISOString() } : {};
  if (consent.marketing_consent) withConsent++;

  const psId = pick(c, "id_customer", "id", "id cliente");
  const myAddresses = addresses.filter((a) => pick(a, "id_customer", "id cliente") === psId && pick(a, "deleted", "eliminado") !== "1");
  const phone = pick(c, "phone", "teléfono") || myAddresses.map((a) => pick(a, "phone_mobile", "móvil", "phone", "teléfono")).find(Boolean) || null;

  if (!apply) { console.log(`[simulación] ${email} · ${name ?? "(sin nombre)"} · ${myAddresses.length} dirección(es)${consent.marketing_consent ? " · acepta novedades" : ""}`); continue; }

  const { data: existing } = await db.from("customers").select("id, name, phone, marketing_consent").eq("email", email).maybeSingle();
  let id = existing?.id;
  if (existing) {
    // Lo que el cliente dejó en la tienda nueva es más reciente: solo se completan datos vacíos
    const patch = {};
    if (!existing.name && name) patch.name = name;
    if (!existing.phone && phone) patch.phone = phone;
    if (!existing.marketing_consent && consent.marketing_consent) Object.assign(patch, consent);
    if (Object.keys(patch).length) await db.from("customers").update(patch).eq("id", id);
    updated++;
  } else {
    const { data, error } = await db.from("customers").insert({ email, name, phone, source: "prestashop", ...consent }).select("id").single();
    if (error) { console.error(`${email}: ${error.message}`); skipped++; continue; }
    id = data.id;
    created++;
  }
  // Evita repetir direcciones (correo duplicado en PrestaShop o importación ejecutada dos veces)
  const { data: saved } = await db.from("addresses").select("street, commune").eq("customer_id", id);
  const key = (s, c) => `${s}|${c}`.toLowerCase().replace(/\s+/g, " ").trim();
  const seen = new Set((saved ?? []).map((a) => key(a.street, a.commune)));
  for (const a of myAddresses) {
    const street = pick(a, "address1", "dirección", "direccion");
    const commune = pick(a, "city", "ciudad", "comuna");
    if (!street || !commune || seen.has(key(street, commune))) continue;
    seen.add(key(street, commune));
    await db.from("addresses").insert({
      customer_id: id,
      street,
      apartment: pick(a, "address2", "dirección (2)", "direccion 2") || null,
      commune,
      region: region(pick(a, "state", "estado", "región", "region")),
      notes: pick(a, "other", "otro") || null,
    });
    addrCount++;
  }
}

console.log(
  apply
    ? `Listo: ${created} nuevos, ${updated} actualizados, ${skipped} omitidos, ${addrCount} direcciones, ${withConsent} con consentimiento de novedades.`
    : `Simulación terminada (${withConsent} con consentimiento). Agrega --aplicar para guardar.`,
);
