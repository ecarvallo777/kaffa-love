import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Costos para calcular la utilidad real (ferias y tienda):
 *  - costo unitario NETO (sin IVA) de cada producto
 *  - gastos de cada jornada de feria (stand, transporte, comida, insumos, otros)
 * Se guardan como JSON privado en Supabase Storage (config/), igual que la configuración.
 */

const BUCKET = "config";
const PRODUCT_COSTS = "costos-productos.json";
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

/** productId → costo unitario neto en CLP */
export async function getProductCosts(): Promise<Record<string, number>> {
  return readJson<Record<string, number>>(PRODUCT_COSTS, {});
}

export async function setProductCost(productId: string, costClp: number | null) {
  const costs = await getProductCosts();
  if (costClp === null) delete costs[productId];
  else costs[productId] = costClp;
  await writeJson(PRODUCT_COSTS, costs);
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
