import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Costos para calcular la utilidad real (ferias y tienda):
 *  - costo unitario NETO (sin IVA) de cada producto, en la tabla product_costs
 *  - gastos de cada jornada de feria (stand, transporte, comida, insumos, otros),
 *    como JSON privado en Supabase Storage (config/), igual que la configuración
 */

const BUCKET = "config";
const FAIR_EXPENSES = "gastos-ferias.json";

export const EXPENSE_CATEGORIES = ["Stand", "Transporte", "Comida", "Insumos", "Otro"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type FairExpense = { id: string; category: ExpenseCategory; concept: string; amountClp: number };

async function readJson<T>(file: string, fallback: T): Promise<T> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(file);
  if (error || !data) return fallback;
  try {
    return JSON.parse(await data.text()) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  const db = createAdminClient();
  const body = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  let { error } = await db.storage.from(BUCKET).upload(file, body, { upsert: true });
  if (error && /not found/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: false });
    ({ error } = await db.storage.from(BUCKET).upload(file, body, { upsert: true }));
  }
  if (error) throw new Error(`No se pudo guardar ${file}: ${error.message}`);
}

// Costos de productos ----------------------------------------------------------------

// Tabla product_costs: cerrada al público (products sí es de lectura pública)

/** productId → costo unitario neto en CLP */
export async function getProductCosts(): Promise<Record<string, number>> {
  const { data, error } = await createAdminClient().from("product_costs").select("product_id, cost_clp");
  if (error) throw new Error(`No se pudieron leer los costos: ${error.message}`);
  return Object.fromEntries((data ?? []).map((r) => [r.product_id as string, r.cost_clp as number]));
}

export async function setProductCost(productId: string, costClp: number | null) {
  const db = createAdminClient();
  const { error } =
    costClp === null
      ? await db.from("product_costs").delete().eq("product_id", productId)
      : await db.from("product_costs").upsert({ product_id: productId, cost_clp: costClp, updated_at: new Date().toISOString() });
  if (error) throw new Error(`No se pudo guardar el costo: ${error.message}`);
}

// Gastos de ferias ----------------------------------------------------------------------

export async function getFairExpenses(): Promise<Record<string, FairExpense[]>> {
  return readJson<Record<string, FairExpense[]>>(FAIR_EXPENSES, {});
}

export async function setFairExpenses(sessionId: string, expenses: FairExpense[]) {
  const all = await getFairExpenses();
  all[sessionId] = expenses;
  await writeJson(FAIR_EXPENSES, all);
}
