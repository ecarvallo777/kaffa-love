const TZ = "America/Santiago";

const dateTime = new Intl.DateTimeFormat("es-CL", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("es-CL", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });

export const fmtDateTime = (d: string | Date | null | undefined) => (d ? dateTime.format(new Date(d)) : "—");
export const fmtDate = (d: string | Date | null | undefined) => (d ? dateOnly.format(new Date(d)) : "—");

/** Inicio del día de hoy en Chile, como ISO (UTC) */
export function startOfTodayChile(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  // Medianoche local: se calcula el desfase real de esa fecha
  const guess = new Date(`${parts}T00:00:00Z`);
  const offsetMin = tzOffsetMinutes(guess);
  return new Date(guess.getTime() - offsetMin * 60_000).toISOString();
}

function tzOffsetMinutes(d: Date) {
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
  return (local.getTime() - utc.getTime()) / 60_000;
}

export const ORDER_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "bad" | "info" }> = {
  pendiente_pago: { label: "Pendiente de pago", tone: "wait" },
  pagado: { label: "Pagado", tone: "info" },
  en_preparacion: { label: "En preparación", tone: "info" },
  despachado: { label: "Despachado", tone: "ok" },
  listo_retiro: { label: "Listo para retiro", tone: "ok" },
  entregado: { label: "Entregado", tone: "ok" },
  rechazado: { label: "Rechazado", tone: "bad" },
  expirado: { label: "Expirado", tone: "bad" },
  cancelado: { label: "Cancelado", tone: "bad" },
};

export const EVENT_LABELS: Record<string, string> = {
  pedido_creado: "Pedido creado",
  pago_iniciado: "Cliente fue a pagar",
  pago_confirmado: "Pago confirmado",
  pago_rechazado: "Pago rechazado",
  pago_tardio: "Pago llegó después de vencer la reserva",
  pago_duplicado: "Posible pago duplicado",
  pago_monto_distinto: "Monto pagado distinto al pedido",
  pago_reembolsado: "Pago reembolsado o contracargo",
  pago_actualizado: "Estado de pago actualizado",
  pedido_expirado: "Reserva vencida, stock liberado",
  estado_cambiado: "Cambio de estado",
  pedido_cancelado: "Pedido cancelado",
  venta_feria: "Venta en feria",
  jornada_abierta: "Jornada abierta",
  jornada_cerrada: "Jornada cerrada",
  stock_ajustado: "Stock ajustado",
  compra_cargada: "Compra cargada",
  producto_creado: "Producto creado",
  producto_editado: "Producto editado",
  receta_creada: "Receta creada",
  receta_editada: "Receta editada",
  receta_eliminada: "Receta eliminada",
  cuenta_creada: "Cuenta de cliente creada",
  baja_novedades: "Se dio de baja de novedades",
};

/** Fecha ISO de hace n días */
export const daysAgoIso = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

/** Fecha de hace n horas */
export const hoursAgo = (n: number) => new Date(Date.now() - n * 3600_000);
