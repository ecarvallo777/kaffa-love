import { connection } from "next/server";
import { getSettings } from "@/lib/settings";
import { requireStaff } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, btn, field } from "@/components/admin/ui";
import { saveStoreSettings, sendSampleEmails } from "./actions";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await connection();
  const [s, staff] = await Promise.all([getSettings(), requireStaff(["admin"], "/admin/configuracion")]);
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Tarifas de despacho, contacto y políticas, impuestos y comisiones. Se aplican al instante."
      />
      <ActionForm action={saveStoreSettings} className="space-y-6">
        <Card title="Tarifas de despacho">
          <p className="mb-4 text-sm text-ink-soft">
            Tarifas de Blue Express con entrega a domicilio desde Santiago (IVA incluido). <strong>XS</strong> (hasta 0,5 kg) se cobra en
            pedidos de solo café con 1 bolsa (250 g); <strong>S</strong> (hasta 3 kg) en todo lo demás. Si dejas XS vacía, se cobra S.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-mute uppercase">
                  <th className="py-2">Región</th><th className="py-2">XS (1 café)</th><th className="py-2">S (resto)</th><th className="py-2">Plazo</th><th className="py-2 text-center">Activa</th>
                </tr>
              </thead>
              <tbody>
                {s.shippingRates.map((r, i) => (
                  <tr key={r.region} className="border-t border-line">
                    <td className="py-2 pr-3">{r.region}</td>
                    <td className="py-2 pr-3"><input name={`xs_${i}`} defaultValue={r.priceXsClp ?? ""} inputMode="numeric" aria-label={`Tarifa XS ${r.region}`} className={`${field} h-9 w-28`} /></td>
                    <td className="py-2 pr-3"><input name={`price_${i}`} aria-label={`Tarifa S ${r.region}`} defaultValue={r.priceClp} inputMode="numeric" className={`${field} h-9 w-28`} /></td>
                    <td className="py-2 pr-3"><input name={`days_${i}`} defaultValue={r.days} className={`${field} h-9`} /></td>
                    <td className="py-2 text-center"><input type="checkbox" name={`enabled_${i}`} defaultChecked={r.enabled} className="size-4 accent-accent" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-6 font-medium">Comunas con tarifa propia</h3>
          <p className="mb-3 text-sm text-ink-soft">
            Para comunas que Blue Express cobra como otra zona (por ejemplo, la provincia de Palena es zona Extremo, o una comuna rural de la
            Región Metropolitana). Reemplazan la tarifa de su región. Para quitar una, deja el nombre vacío.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-mute uppercase">
                  <th className="py-2">Comuna</th><th className="py-2">XS (1 café)</th><th className="py-2">S (resto)</th>
                </tr>
              </thead>
              <tbody>
                {[...s.communeRates, ...Array.from({ length: 3 }, () => null)].map((c, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="py-2 pr-3"><input name={`cname_${i}`} defaultValue={c?.commune ?? ""} placeholder={c ? "" : "Agregar comuna"} aria-label="Comuna" className={`${field} h-9`} /></td>
                    <td className="py-2 pr-3"><input name={`cxs_${i}`} defaultValue={c?.priceXsClp ?? ""} inputMode="numeric" aria-label="Tarifa XS de la comuna" className={`${field} h-9 w-28`} /></td>
                    <td className="py-2 pr-3"><input name={`cs_${i}`} defaultValue={c?.priceClp ?? ""} inputMode="numeric" aria-label="Tarifa S de la comuna" className={`${field} h-9 w-28`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <input type="hidden" name="communeRows" value={s.communeRates.length + 3} />
          <Field label="Despacho gratis desde (CLP)" hint="Déjalo vacío para no ofrecer despacho gratis." className="mt-5 max-w-xs">
            <input name="freeShippingFromClp" defaultValue={s.freeShippingFromClp ?? ""} inputMode="numeric" className={field} />
          </Field>
        </Card>

        <Card title="Contacto y políticas">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Correo de contacto"><input name="contactEmail" type="email" defaultValue={s.contactEmail} className={field} /></Field>
            <Field label="Teléfono / WhatsApp"><input name="contactPhone" defaultValue={s.contactPhone} className={field} /></Field>
            <Field label="Instagram (URL)"><input name="instagram" defaultValue={s.instagram} className={field} /></Field>
            <Field label="Días para cambios y devoluciones" hint="Mínimo 10 (derecho a retracto en compras a distancia).">
              <input name="returnDays" type="number" min={10} defaultValue={s.returnDays} className={field} />
            </Field>
          </div>
        </Card>
        <Card title="Impuestos y comisiones">
          <p className="mb-4 text-sm text-ink-soft">
            Se usan para calcular la utilidad real de cada feria y de la tienda. Revisa las comisiones en tu cuenta de Mercado Pago
            (incluye el IVA de la comisión si corresponde).
          </p>
          {(s.mpFeriaPct === 0 || s.mpTiendaPct === 0) && (
            <p className="mb-4 rounded-xl bg-crema/15 px-3 py-2 text-sm text-[#8a5a1c]">
              Falta ingresar alguna comisión de Mercado Pago: mientras esté en 0 %, la utilidad aparecerá más alta de lo real.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="IVA (%)" hint="Incluido en los precios.">
              <input name="ivaPct" inputMode="decimal" defaultValue={s.ivaPct} className={field} />
            </Field>
            <Field label="Comisión Point en feria (%)" hint="Mercado Pago Point.">
              <input name="mpFeriaPct" inputMode="decimal" defaultValue={s.mpFeriaPct} className={field} />
            </Field>
            <Field label="Comisión tienda online (%)" hint="Mercado Pago Checkout Pro.">
              <input name="mpTiendaPct" inputMode="decimal" defaultValue={s.mpTiendaPct} className={field} />
            </Field>
          </div>
        </Card>
        <Card title="Bienvenida del QR de feria">
          <p className="mb-4 text-sm text-ink-soft">
            Quien llega escaneando el QR de la feria (<code>kaffalove.cl/?utm_source=feria</code>) ve este descuento en el carrito y en el pago. Se aplica
            solo si su correo no tiene compras online anteriores. Ponlo en 0 para desactivarlo.
          </p>
          <div className="max-w-xs">
            <Field label="Descuento en la primera compra online (%)">
              <input name="welcomePct" type="number" min={0} max={50} defaultValue={s.welcomePct} className={field} />
            </Field>
          </div>
        </Card>
        <Card title="Correos automáticos">
          <p className="mb-4 text-sm text-ink-soft">
            Solo se envían a clientes que aceptaron recibir novedades, una vez por pedido y nunca si ya volvieron a comprar. Cada correo
            incluye un enlace para darse de baja.
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" name="emailAbandonedCart" defaultChecked={s.emailAbandonedCart} className="mt-1 size-4 accent-accent" />
              <span>
                <span className="font-medium">Carrito abandonado</span>
                <span className="block text-sm text-ink-soft">Si un pedido vence sin pagarse, unas horas después le recordamos sus productos con un botón para retomar la compra.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="emailRepurchase" defaultChecked={s.emailRepurchase} className="mt-1 size-4 accent-accent" />
              <span>
                <span className="font-medium">Recordatorio de recompra</span>
                <span className="block text-sm text-ink-soft">Cuando el café de su último pedido debería estar por acabarse, le ofrecemos repetirlo con la misma molienda.</span>
              </span>
            </label>
          </div>
          <div className="mt-4 max-w-xs">
            <Field label="Días después de la compra" hint="Una bolsa de 250 g dura unas 2 a 3 semanas.">
              <input name="repurchaseDays" type="number" min={5} max={90} defaultValue={s.repurchaseDays} className={field} />
            </Field>
          </div>
          <label className="mt-5 flex items-start gap-3">
            <input type="checkbox" name="emailReview" defaultChecked={s.emailReview} className="mt-1 size-4 accent-accent" />
            <span>
              <span className="font-medium">Pedido de reseña</span>
              <span className="block text-sm text-ink-soft">Una semana después de pagar, le pedimos que cuente cómo le fue con una reseña. Como máximo una vez cada 90 días por cliente.</span>
            </span>
          </label>
          <div className="mt-4">
            <Field label="Enlace para dejar la reseña" hint="En tu perfil de empresa de Google: «Pedir reseñas» → copia el enlace. Sin enlace, este correo no se envía.">
              <input name="reviewUrl" type="url" placeholder="https://g.page/r/…/review" defaultValue={s.reviewUrl} className={field} />
            </Field>
          </div>
        </Card>
        <button className={btn.primary}>Guardar configuración</button>
      </ActionForm>
      <Card title="Ver los correos automáticos" className="mt-6">
        <p className="mb-4 text-sm text-ink-soft">
          Te enviamos un ejemplo de cada uno (carrito abandonado, recompra y reseña), armado con el último pedido online con café. No se envía nada a
          clientes.
        </p>
        <ActionForm action={sendSampleEmails} className="flex flex-wrap items-end gap-3">
          <Field label="Enviar a">
            <input name="to" type="email" required defaultValue={staff.email} className={`${field} min-w-72`} />
          </Field>
          <button className={btn.secondary}>Enviarme ejemplos</button>
        </ActionForm>
      </Card>
    </>
  );
}
