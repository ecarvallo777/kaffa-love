// Crea (o actualiza) una persona del equipo con acceso a la administración o feria.
//
//   node scripts/crear-usuario.mjs <correo> "<Nombre>" [admin|operador]
//
// Genera una contraseña segura y la guarda en .credenciales-<correo>.txt
// (ignorado por git). Después se puede cambiar desde Administración > Equipo.
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { adminDb } from "./e2e/db.mjs";

const [email, name, roleArg = "admin"] = process.argv.slice(2);
if (!email || !name) {
  console.error('Uso: node scripts/crear-usuario.mjs <correo> "<Nombre>" [admin|operador]');
  process.exit(1);
}
const role = roleArg === "operador" ? "operador" : "admin";
const password = process.env.NEW_USER_PASSWORD ?? randomBytes(12).toString("base64url");
const db = adminDb();

let userId;
const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
if (error) {
  if (!/already|registered|exists/i.test(error.message)) throw new Error(error.message);
  const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
  userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
  await db.auth.admin.updateUserById(userId, { password });
  console.log("El usuario ya existía: se actualizó su contraseña.");
} else {
  userId = data.user.id;
}

const { error: staffError } = await db.from("staff").upsert({ user_id: userId, name, role });
if (staffError) throw new Error(staffError.message);

const file = `.credenciales-${email.replace(/[^a-z0-9@._-]/gi, "_")}.txt`;
fs.writeFileSync(file, `Correo: ${email}\nContraseña: ${password}\nRol: ${role}\nIngreso: /ingresar\n`);
console.log(`Listo: ${name} (${role}). Credenciales guardadas en ${file}`);
