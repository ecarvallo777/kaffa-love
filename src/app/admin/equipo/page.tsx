import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStaff } from "@/lib/auth";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, PageHeader, Pill, btn, field } from "@/components/admin/ui";
import { addMember, updateMember } from "./actions";

export const metadata = { title: "Equipo" };

export default async function TeamPage() {
  await connection();
  const db = createAdminClient();
  const [{ data: staff }, { data: users }, me] = await Promise.all([
    db.from("staff").select("user_id, name, role").order("name"),
    db.auth.admin.listUsers({ perPage: 1000 }),
    getStaff(),
  ]);
  const emailOf = (id: string) => users?.users.find((u) => u.id === id)?.email ?? "";

  return (
    <>
      <PageHeader title="Equipo" description="Quién puede entrar a la administración (admin) o solo a la vista de feria (operador)." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {(staff ?? []).map((s) => (
            <Card key={s.user_id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.name} {s.user_id === me?.userId && <span className="text-ink-mute">(tú)</span>}</p>
                  <p className="text-sm text-ink-soft">{emailOf(s.user_id)}</p>
                </div>
                <Pill tone={s.role === "admin" ? "info" : "neutral"}>{s.role === "admin" ? "Administrador" : "Operador de feria"}</Pill>
              </div>
              {s.user_id !== me?.userId && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <ActionForm action={updateMember} className="flex gap-2">
                    <input type="hidden" name="userId" value={s.user_id} />
                    <input type="hidden" name="op" value="role" />
                    <input type="hidden" name="role" value={s.role === "admin" ? "operador" : "admin"} />
                    <button className={btn.secondary}>Cambiar a {s.role === "admin" ? "operador" : "admin"}</button>
                  </ActionForm>
                  <ActionForm action={updateMember} className="flex gap-2">
                    <input type="hidden" name="userId" value={s.user_id} />
                    <input type="hidden" name="op" value="password" />
                    <input name="password" type="password" placeholder="Nueva contraseña" minLength={10} className={`${field} h-10 w-44`} />
                    <button className={btn.secondary}>Cambiar</button>
                  </ActionForm>
                  <ActionForm action={updateMember} confirm={`¿Quitar el acceso de ${s.name}?`}>
                    <input type="hidden" name="userId" value={s.user_id} />
                    <input type="hidden" name="op" value="remove" />
                    <button className={btn.danger}>Quitar acceso</button>
                  </ActionForm>
                </div>
              )}
              {s.user_id === me?.userId && (
                <ActionForm action={updateMember} className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                  <input type="hidden" name="userId" value={s.user_id} />
                  <input type="hidden" name="op" value="password" />
                  <input name="password" type="password" placeholder="Nueva contraseña (mín. 10)" minLength={10} className={`${field} h-10 w-56`} />
                  <button className={btn.secondary}>Cambiar mi contraseña</button>
                </ActionForm>
              )}
            </Card>
          ))}
        </div>
        <Card title="Agregar persona">
          <ActionForm action={addMember} resetOnSuccess className="space-y-4">
            <Field label="Nombre"><input name="name" required className={field} /></Field>
            <Field label="Correo"><input name="email" type="email" required className={field} /></Field>
            <Field label="Rol">
              <select name="role" className={field}>
                <option value="operador">Operador de feria</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>
            <Field label="Contraseña inicial" hint="Mínimo 10 caracteres. Compártela por un canal seguro; la persona puede cambiarla después.">
              <input name="password" type="text" required minLength={10} autoComplete="off" className={field} />
            </Field>
            <button className={btn.primary}>Agregar</button>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
