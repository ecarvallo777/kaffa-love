"use server";

import { updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { adjustStock } from "@/lib/stock";
import { logEvent } from "@/lib/events";
import { parsePurchase, type PurchaseRow } from "@/lib/purchases";

export type PreviewState = { rows?: PurchaseRow[]; fileName?: string; error?: string; applied?: string } | null;

export async function previewPurchase(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  await requireStaff(["admin"]);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Elige el archivo Excel (.xlsx)." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "El archivo debe ser .xlsx (Excel)." };
  try {
    const rows = await parsePurchase(await file.arrayBuffer());
    if (!rows.length) return { error: "La planilla no tiene filas con datos." };
    return { rows, fileName: file.name };
  } catch (e) {
    return { error: `No pude leer la planilla: ${(e as Error).message}` };
  }
}

/** Aplica la compra. Vuelve a leer el archivo para no confiar en datos del navegador. */
export async function applyPurchase(_prev: PreviewState, form: FormData): Promise<PreviewState> {
  const staff = await requireStaff(["admin"]);
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Vuelve a elegir el archivo para confirmar." };
  const rows = await parsePurchase(await file.arrayBuffer());
  const valid = rows.filter((r) => r.kind !== "error");
  if (!valid.length) return { rows, error: "No hay filas válidas para aplicar." };

  const db = createAdminClient();
  const note = `Compra ${file.name}`;
  let created = 0;
  let added = 0;
  const failures: string[] = [];

  for (const r of valid) {
    const costNote = r.costClp !== null ? `${note} · costo $${r.costClp}` : note;
    try {
      if (r.kind === "existente") {
        await adjustStock({ productId: r.productId!, delta: r.qty, reason: "compra", note: costNote, userId: staff.userId });
      } else {
        const p = r.newProduct!;
        const { data, error } = await db
          .from("products")
          .insert({
            name: p.name,
            slug: p.slug,
            type: p.type,
            category_id: p.categoryId,
            price_clp: p.priceClp,
            stock: r.qty,
            track_stock: true,
            visible_online: p.type !== "preparado",
            weight_g: p.weight_g,
            length_cm: p.length_cm,
            width_cm: p.width_cm,
            height_cm: p.height_cm,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        await db.from("stock_movements").insert({ product_id: data.id, delta: r.qty, reason: "compra", note: costNote, created_by: staff.userId });
        created++;
      }
      added += r.qty;
    } catch (e) {
      failures.push(`Fila ${r.row}: ${(e as Error).message}`);
    }
  }

  await logEvent("compra_cargada", "purchase", null, { archivo: file.name, filas: valid.length, unidades: added, nuevos: created, por: staff.email });
  updateTag("catalog");
  return {
    applied: `Listo: ${added} unidades sumadas en ${valid.length - failures.length} filas${created ? `, ${created} productos nuevos (revisa su ficha y fotos)` : ""}.`,
    error: failures.length ? failures.join(" · ") : undefined,
  };
}
