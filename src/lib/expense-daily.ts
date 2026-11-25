import "server-only";
import { getLedger, syncLedger } from "@/lib/expense-ledger";
import { getSheetConfig, syncSheet } from "@/lib/expense-sheet";

/** Tarea periódica: una vez al día (desde las 5:00 de Chile) lee Mercado Pago y actualiza la planilla de gastos */
export async function dailyExpenseSync(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hourCycle: "h23" }).format(now));
  if (hour < 5) return null;
  const { syncedAt } = await getLedger();
  if (syncedAt && now.getTime() - new Date(syncedAt).getTime() < 20 * 3600_000) return null;
  const r = await syncLedger(now);
  if (!r.enabled) return null;
  const sheet = (await getSheetConfig()) ? await syncSheet().then(() => "ok").catch((e: Error) => e.message) : "sin planilla";
  return { ...r, sheet };
}
