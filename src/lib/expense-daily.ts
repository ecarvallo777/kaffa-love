import "server-only";
import { getLedger, importLatestMovements, requestDailyMovements, syncLedger } from "@/lib/expense-ledger";
import { getSheetConfig, syncSheet } from "@/lib/expense-sheet";

const updateSheet = async () => ((await getSheetConfig()) ? await syncSheet().then(() => "ok").catch((e: Error) => e.message) : "sin planilla");

/**
 * Tarea periódica de gastos:
 *   - una vez al día (desde las 5:00 de Chile): lee los pagos de Mercado Pago y pide el reporte de movimientos;
 *   - cuando ese reporte está listo (minutos después): suma las transferencias y retiros.
 * Después de cada cambio actualiza la planilla.
 */
export async function dailyExpenseSync(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hourCycle: "h23" }).format(now));
  const { syncedAt, movementsRequestedAt, movementsFile } = await getLedger();
  // Reporte pedido y aún no leído: se revisa en cada pasada hasta que esté listo
  if (movementsRequestedAt && (!syncedAt || movementsRequestedAt >= syncedAt) && now.getTime() - new Date(movementsRequestedAt).getTime() < 6 * 3600_000) {
    const m = await importLatestMovements();
    if (m.read) return { movements: m.added, file: movementsFile !== null, sheet: await updateSheet() };
  }
  if (hour < 5) return null;
  if (syncedAt && now.getTime() - new Date(syncedAt).getTime() < 20 * 3600_000) return null;
  const r = await syncLedger(now);
  if (!r.enabled) return null;
  await requestDailyMovements(now).catch((e) => console.error("[gastos] reporte de movimientos:", e));
  return { ...r, sheet: await updateSheet() };
}
