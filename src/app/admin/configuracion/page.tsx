import { connection } from "next/server";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, btn, field } from "@/components/admin/ui";
import { saveStoreSettings } from "./actions";

export const metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await connection();
  const s = await getSettings();
  return (
    <>
      <PageHeader
        title="Configuración"
        description="Tarifas de despacho, contacto y políticas, impuestos y comisiones. Se aplican al instante."
      />
      <ActionForm action={saveStoreSettings} className="space-y-6">
        <Card title="Tarifas de despacho">
          <p className="mb-4 text-sm text-ink-soft">
            Mientras no esté conectada la API de Blue Express, el checkout usa esta tabla. Revisa los valores con tu tarifario antes de vender.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-mute uppercase">
                  <th className="py-2">Región</th><th className="py-2">Tarifa (CLP)</th><th className="py-2">Plazo</th><th className="py-2 text-center">Activa</th>
                </tr>
              </thead>
              <tbody>
                {s.shippingRates.map((r, i) => (
                  <tr key={r.region} className="border-t border-line">
                    <td className="py-2 pr-3">{r.region}</td>
                    <td className="py-2 pr-3"><input name={`price_${i}`} defaultValue={r.priceClp} inputMode="numeric" className={`${field} h-9 w-28`} /></td>
                    <td className="py-2 pr-3"><input name={`days_${i}`} defaultValue={r.days} className={`${field} h-9`} /></td>
                    <td className="py-2 text-center"><input type="checkbox" name={`enabled_${i}`} defaultChecked={r.enabled} className="size-4 accent-accent" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        <button className={btn.primary}>Guardar configuración</button>
      </ActionForm>
    </>
  );
}
