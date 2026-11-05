import "server-only";
import ExcelJS from "exceljs";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/slug";

/*
 * Carga de compras desde Excel.
 * Cada fila: un producto existente (por SKU o dirección web) al que se le
 * suma stock, o un producto nuevo (con nombre, tipo y precio).
 */

export const COLUMNS = [
  { key: "ref", header: "SKU o dirección web", width: 28, note: "Para productos existentes. Déjalo vacío si es nuevo." },
  { key: "name", header: "Nombre (si es nuevo)", width: 32 },
  { key: "type", header: "Tipo (cafe / accesorio / preparado)", width: 22 },
  { key: "category", header: "Categoría (dirección web)", width: 24 },
  { key: "qty", header: "Cantidad comprada", width: 12 },
  { key: "cost", header: "Costo unitario (CLP)", width: 14 },
  { key: "price", header: "Precio de venta (si es nuevo)", width: 16 },
  { key: "weight", header: "Peso (g)", width: 10 },
  { key: "length", header: "Largo (cm)", width: 10 },
  { key: "width", header: "Ancho (cm)", width: 10 },
  { key: "height", header: "Alto (cm)", width: 10 },
] as const;

export type PurchaseRow = {
  row: number;
  kind: "existente" | "nuevo" | "error";
  productId?: string;
  name: string;
  qty: number;
  costClp: number | null;
  stockBefore?: number;
  newProduct?: {
    name: string;
    slug: string;
    type: "cafe" | "accesorio" | "preparado";
    categoryId: string | null;
    priceClp: number;
    weight_g: number | null;
    length_cm: number | null;
    width_cm: number | null;
    height_cm: number | null;
  };
  message?: string;
};

export async function buildTemplate() {
  const db = createAdminClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    db.from("products").select("sku, slug, name, type, stock").eq("active", true).neq("type", "promocion").order("name"),
    db.from("categories").select("slug, name").order("sort_order"),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kaffa Love";
  const sheet = wb.addWorksheet("Compra");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE4D5" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const example = products?.[0];
  if (example) sheet.addRow({ ref: example.sku ?? example.slug, qty: 10, cost: 6500 });
  sheet.addRow({ name: "Nuevo café, Origen", type: "cafe", category: "cafe-de-especialidad", qty: 20, cost: 7000, price: 14900, weight: 300, length: 20, width: 12, height: 7 });

  const ref = wb.addWorksheet("Productos actuales");
  ref.columns = [
    { header: "SKU o dirección web", key: "ref", width: 32 },
    { header: "Nombre", key: "name", width: 40 },
    { header: "Tipo", key: "type", width: 14 },
    { header: "Stock actual", key: "stock", width: 12 },
  ];
  ref.getRow(1).font = { bold: true };
  for (const p of products ?? []) ref.addRow({ ref: p.sku ?? p.slug, name: p.name, type: p.type, stock: p.stock });

  const cats = wb.addWorksheet("Categorías");
  cats.columns = [{ header: "Dirección web", key: "slug", width: 30 }, { header: "Nombre", key: "name", width: 30 }];
  cats.getRow(1).font = { bold: true };
  for (const c of categories ?? []) cats.addRow(c);

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function cellValue(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if ("result" in v && v.result !== undefined) return String(v.result);
    if ("text" in v) return String(v.text);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if (v instanceof Date) return v.toISOString();
  }
  return String(v).trim();
}

const toNum = (s: string) => {
  if (!s) return null;
  const n = Number(s.replace(/[$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export async function parsePurchase(file: ArrayBuffer): Promise<PurchaseRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(file);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo no tiene hojas.");

  const db = createAdminClient();
  const [{ data: products }, { data: categories }] = await Promise.all([
    db.from("products").select("id, sku, slug, name, type, stock, track_stock"),
    db.from("categories").select("id, slug"),
  ]);

  const rows: PurchaseRow[] = [];
  const newSlugs = new Set<string>();
  sheet.eachRow((r, i) => {
    if (i === 1) return;
    const get = (k: (typeof COLUMNS)[number]["key"]) => cellValue(r.getCell(COLUMNS.findIndex((c) => c.key === k) + 1).value);
    const ref = get("ref");
    const name = get("name");
    if (!ref && !name && !get("qty")) return;

    const qty = toNum(get("qty"));
    const cost = toNum(get("cost"));
    const base = { row: i, name: name || ref, qty: qty ?? 0, costClp: cost !== null && !Number.isNaN(cost) ? Math.round(cost) : null };

    if (qty === null || Number.isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
      rows.push({ ...base, kind: "error", message: "La cantidad debe ser un entero mayor que cero." });
      return;
    }
    if (cost !== null && (Number.isNaN(cost) || cost < 0)) {
      rows.push({ ...base, kind: "error", message: "El costo no es un número válido." });
      return;
    }

    if (ref) {
      const p = products?.find((x) => (x.sku && x.sku.toLowerCase() === ref.toLowerCase()) || x.slug === ref.toLowerCase());
      if (!p) return rows.push({ ...base, kind: "error", message: `No existe un producto "${ref}".` }), undefined;
      if (p.type === "promocion") return rows.push({ ...base, name: p.name, kind: "error", message: "Las promociones no tienen stock propio." }), undefined;
      if (!p.track_stock) return rows.push({ ...base, name: p.name, kind: "error", message: "Este producto no controla stock." }), undefined;
      rows.push({ ...base, name: p.name, kind: "existente", productId: p.id, stockBefore: p.stock });
      return;
    }

    const type = get("type").toLowerCase().replace("é", "e");
    if (!["cafe", "accesorio", "preparado"].includes(type)) {
      rows.push({ ...base, kind: "error", message: "Indica el tipo: cafe, accesorio o preparado." });
      return;
    }
    const price = toNum(get("price"));
    if (price === null || Number.isNaN(price) || price <= 0) {
      rows.push({ ...base, kind: "error", message: "Un producto nuevo necesita precio de venta." });
      return;
    }
    const slug = slugify(name);
    if (products?.some((p) => p.slug === slug) || newSlugs.has(slug)) {
      rows.push({ ...base, kind: "error", message: `Ya existe un producto con ese nombre (${slug}). Usa la columna SKU o dirección web.` });
      return;
    }
    newSlugs.add(slug);
    const catSlug = get("category").toLowerCase();
    const category = categories?.find((c) => c.slug === catSlug);
    if (catSlug && !category) {
      rows.push({ ...base, kind: "error", message: `No existe la categoría "${catSlug}".` });
      return;
    }
    const dim = (k: "weight" | "length" | "width" | "height") => {
      const n = toNum(get(k));
      return n !== null && !Number.isNaN(n) && n > 0 ? n : null;
    };
    rows.push({
      ...base,
      kind: "nuevo",
      newProduct: {
        name,
        slug,
        type: type as "cafe" | "accesorio" | "preparado",
        categoryId: category?.id ?? null,
        priceClp: Math.round(price),
        weight_g: dim("weight"),
        length_cm: dim("length"),
        width_cm: dim("width"),
        height_cm: dim("height"),
      },
    });
  });
  return rows;
}
