import "server-only";

/** URL pública del sitio, sin "/" final. En producción debe ser https. */
export function siteUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000");
  return fromEnv.replace(/\/$/, "");
}

export const isProduction = () => process.env.NODE_ENV === "production";

export const mercadoPagoConfigured = () => !!process.env.MP_ACCESS_TOKEN;

/**
 * El pago simulado solo existe fuera de producción y mientras no haya
 * credenciales de Mercado Pago. Sirve para probar el flujo completo.
 */
export const simulatedPaymentsEnabled = () =>
  !mercadoPagoConfigured() && (!isProduction() || process.env.ALLOW_SIMULATED_PAYMENTS === "true");
