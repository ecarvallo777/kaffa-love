import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGIONES } from "@/lib/chile";

/*
 * Configuración de la tienda que se edita desde la administración.
 * Se guarda como un archivo JSON privado en Supabase Storage, así no
 * requiere cambios en la base de datos.
 */

export type ShippingRate = {
  region: string;
  priceClp: number;
  days: string;
  enabled: boolean;
};

export type Settings = {
  shippingRates: ShippingRate[];
  /** Despacho gratis desde este subtotal (null = nunca) */
  freeShippingFromClp: number | null;
  contactEmail: string;
  contactPhone: string;
  instagram: string;
  /** Días para devolver accesorios sin uso */
  returnDays: number;
  /** IVA incluido en los precios (%) */
  ivaPct: number;
  /** Comisión de Mercado Pago Point en ferias (% sobre lo cobrado) */
  mpFeriaPct: number;
  /** Comisión de Mercado Pago Checkout Pro en la tienda online (% sobre lo cobrado) */
  mpTiendaPct: number;
  /** Correo automático al vencer un carrito sin pago (solo a quien aceptó novedades) */
  emailAbandonedCart: boolean;
  /** Correo automático de recompra después de comprar café (solo a quien aceptó novedades) */
  emailRepurchase: boolean;
  /** Días después de la compra para el correo de recompra */
  repurchaseDays: number;
};

const BUCKET = "config";
const FILE = "settings.json";

export const DEFAULT_SETTINGS: Settings = {
  // Valores de partida: el administrador debe confirmarlos antes de vender
  shippingRates: REGIONES.map((region) => ({
    region,
    priceClp: region === "Metropolitana de Santiago" ? 3990 : 5990,
    days: region === "Metropolitana de Santiago" ? "1 a 3 días hábiles" : "2 a 5 días hábiles",
    enabled: true,
  })),
  freeShippingFromClp: null,
  contactEmail: "",
  contactPhone: "",
  instagram: "https://instagram.com/kaffaloveroasters11.11",
  returnDays: 10,
  ivaPct: 19,
  // Sin valor por defecto: se ingresan desde la administración según el contrato con Mercado Pago
  mpFeriaPct: 0,
  mpTiendaPct: 0,
  emailAbandonedCart: true,
  emailRepurchase: true,
  // Una bolsa de 250 g dura unas 2 a 3 semanas
  repurchaseDays: 18,
};

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheLife("hours");
  cacheTag("settings");

  const { data, error } = await createAdminClient().storage.from(BUCKET).download(FILE);
  if (error || !data) return DEFAULT_SETTINGS;
  try {
    const saved = JSON.parse(await data.text()) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings) {
  const db = createAdminClient();
  const body = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
  let { error } = await db.storage.from(BUCKET).upload(FILE, body, { upsert: true });
  if (error && /not found/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: false });
    ({ error } = await db.storage.from(BUCKET).upload(FILE, body, { upsert: true }));
  }
  if (error) throw new Error(`No se pudo guardar la configuración: ${error.message}`);
}

export function shippingQuote(settings: Settings, region: string, subtotalClp: number) {
  const rate = settings.shippingRates.find((r) => r.region === region && r.enabled);
  if (!rate) return null;
  const free = settings.freeShippingFromClp !== null && subtotalClp >= settings.freeShippingFromClp;
  return {
    service: `Despacho a domicilio (${rate.days})`,
    priceClp: free ? 0 : rate.priceClp,
    days: rate.days,
    free,
  };
}
