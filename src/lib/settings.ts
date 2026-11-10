import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { REGIONES } from "@/lib/chile";
import { rateFor, ratePrice, type CommuneRate, type ParcelSize } from "@/lib/shipping";

/*
 * Configuración de la tienda que se edita desde la administración.
 * Se guarda como un archivo JSON privado en Supabase Storage, así no
 * requiere cambios en la base de datos.
 */

export type ShippingRate = {
  region: string;
  /** Tarifa paquete S (hasta 3 kg): la general */
  priceClp: number;
  /** Tarifa paquete XS (hasta 0,5 kg): pedidos de solo café con 1 bolsa. null = se usa la S */
  priceXsClp?: number | null;
  days: string;
  enabled: boolean;
};

export type Settings = {
  shippingRates: ShippingRate[];
  /** Comunas con tarifa propia (otra zona de Blue Express que su región) */
  communeRates: CommuneRate[];
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
  /** Correo pidiendo una reseña una semana después de comprar (solo a quien aceptó novedades) */
  emailReview: boolean;
  /** Enlace para dejar la reseña (perfil de empresa en Google); sin enlace no se envía */
  reviewUrl: string;
  /** % de descuento en la primera compra online para quien llega por el QR de feria (0 = sin descuento) */
  welcomePct: number;
};

const BUCKET = "config";
const FILE = "settings.json";

/** Zona "Extremo" de Blue Express (norte grande y extremo sur) */
const EXTREME_REGIONS = new Set<string>([
  "Arica y Parinacota",
  "Tarapacá",
  "Antofagasta",
  "Aysén del General Carlos Ibáñez del Campo",
  "Magallanes y de la Antártica Chilena",
]);

export const DEFAULT_SETTINGS: Settings = {
  // Valores de partida: el administrador debe confirmarlos antes de vender
  // Tarifario pyme de Blue Express, entrega a domicilio desde Santiago (IVA incluido)
  shippingRates: REGIONES.map((region) => {
    const zone = region === "Metropolitana de Santiago" ? "santiago" : EXTREME_REGIONS.has(region) ? "extremo" : "centro";
    return {
      region,
      priceXsClp: { santiago: 3100, centro: 4300, extremo: 5200 }[zone],
      priceClp: { santiago: 4200, centro: 5600, extremo: 9500 }[zone],
      days: zone === "santiago" ? "1 a 3 días hábiles" : "2 a 5 días hábiles",
      enabled: true,
    };
  }),
  // Provincia de Palena: zona Extremo en el mapa del tarifario (Chiloé y el resto de Los Lagos son Centro)
  communeRates: ["Chaitén", "Futaleufú", "Hualaihué", "Palena"].map((commune) => ({ commune, priceXsClp: 5200, priceClp: 9500 })),
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
  emailReview: true,
  reviewUrl: "",
  welcomePct: 10,
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

export function shippingQuote(settings: Settings, region: string, commune: string, subtotalClp: number, size: ParcelSize = "s") {
  const regionRate = settings.shippingRates.find((r) => r.region === region && r.enabled);
  if (!regionRate) return null;
  const rate = rateFor(regionRate, commune, settings.communeRates);
  const free = settings.freeShippingFromClp !== null && subtotalClp >= settings.freeShippingFromClp;
  return {
    service: `Despacho a domicilio (${rate.days})`,
    priceClp: free ? 0 : ratePrice(rate, size),
    days: rate.days,
    free,
  };
}
