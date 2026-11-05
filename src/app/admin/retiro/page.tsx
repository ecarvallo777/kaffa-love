import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, btn, field } from "@/components/admin/ui";
import { savePickup } from "./actions";

export const metadata = { title: "Lugares de retiro" };

type Pickup = { id: string; name: string; address: string; hours: string; active: boolean };

export default async function PickupPage() {
  await connection();
  const { data } = await createAdminClient().from("pickup_locations").select("*").order("name");
  return (
    <>
      <PageHeader title="Lugares de retiro" description="Se muestran en el checkout. Solo los activos se pueden elegir." />
      <div className="grid gap-6 lg:grid-cols-2">
        {(data as Pickup[] | null)?.map((p) => (
          <Card key={p.id} title={p.name}>
            <PickupForm pickup={p} />
          </Card>
        ))}
        <Card title="Agregar lugar">
          <PickupForm pickup={null} />
        </Card>
      </div>
    </>
  );
}

function PickupForm({ pickup }: { pickup: Pickup | null }) {
  return (
    <ActionForm action={savePickup} resetOnSuccess={!pickup} className="space-y-4">
      {pickup && <input type="hidden" name="id" value={pickup.id} />}
      <Field label="Nombre"><input name="name" required defaultValue={pickup?.name} placeholder="Tostaduría Kaffa Love" className={field} /></Field>
      <Field label="Dirección"><input name="address" required defaultValue={pickup?.address} placeholder="Calle 123, Comuna" className={field} /></Field>
      <Field label="Días y horario"><input name="hours" required defaultValue={pickup?.hours} placeholder="Lunes a viernes, 10:00 a 18:00" className={field} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={pickup?.active ?? true} className="size-4 accent-accent" /> Activo
      </label>
      <button className={btn.primary}>{pickup ? "Guardar" : "Agregar"}</button>
    </ActionForm>
  );
}
