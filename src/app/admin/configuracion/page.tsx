import { connection } from "next/server";
import { getSettings } from "@/lib/settings";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, btn, field } from "@/components/admin/ui";
import { saveStoreSettings } from "./actions";

export const metadata = { title: "Despacho y tienda" };

export default async function SettingsPage() {
  await connection();
  const s = await getSettings();
  return (
    <>
      <PageHeader
        title="Despacho y tienda"
        description="Tarifas de despacho por región (Blue Express), contacto y políticas. Se aplican al instante en el checkout."
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
        <button className={btn.primary}>Guardar configuración</button>
      </ActionForm>
    </>
  );
}
