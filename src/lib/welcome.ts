/*
 * Descuento de bienvenida para quien llega escaneando el QR de la feria
 * (enlace con ?utm_source=feria): un porcentaje en su primera compra online.
 * El servidor confirma que el correo no tenga compras online pagadas antes.
 * Como el total del pedido debe ser productos + despacho, el descuento se
 * aplica al precio de cada producto (es lo que realmente se cobra).
 * Se usa igual en el navegador (checkout) y en el servidor (precio final).
 */

export const WELCOME_SOURCE = "feria";

/** Precio unitario con el descuento aplicado */
export const welcomeUnitPrice = (priceClp: number, pct: number) => priceClp - Math.round((priceClp * pct) / 100);

/** Descuento total de las líneas */
export const welcomeDiscount = (lines: { priceClp: number; qty: number }[], pct: number) =>
  lines.reduce((s, l) => s + (l.priceClp - welcomeUnitPrice(l.priceClp, pct)) * l.qty, 0);
