# Respaldos

Cada lunes a las 4:00 un Apps Script en el Google Drive de la tienda descarga un respaldo completo desde `https://kaffalove.cl/api/respaldo` y lo guarda comprimido en la carpeta **Respaldos Kaffa Love** (`kaffa-love-AAAA-MM-DD.json.gz`). Se conservan los últimos 12. La instalación está en `docs/PRODUCCION.md` (7.4).

**Qué incluye:**
- Todas las tablas.
- Los JSON de configuración (recetas, compras, ajustes).
- La lista de usuarios (id y correo, sin contraseñas).

**Qué no incluye:** las fotos de productos. Están en Supabase Storage (bucket `productos`); guarda los originales.

En **Admin → Resumen** aparece un aviso si pasan más de 8 días sin respaldo.

## Restaurar

1. Descarga el respaldo de Drive.
2. Revisa qué trae:
   ```
   node scripts/respaldo/restaurar.mjs kaffa-love-AAAA-MM-DD.json.gz
   ```
3. Si la base es nueva, aplica primero las migraciones (`supabase/migrations`) en el SQL Editor.
4. Genera el SQL y ejecútalo en el SQL Editor de Supabase:
   ```
   node scripts/respaldo/restaurar.mjs kaffa-love-AAAA-MM-DD.json.gz --sql restaurar.sql
   ```
   El SQL:
   - No borra nada: las filas que ya existen quedan como están.
   - Conserva los números de pedido.
   - Hace que los números nuevos sigan después del último restaurado.
5. Sube los archivos de configuración. Primero sin `--aplicar` para ver la lista; con `--aplicar` reemplazan los actuales:
   ```
   node scripts/respaldo/restaurar.mjs kaffa-love-AAAA-MM-DD.json.gz --config --aplicar
   ```
6. Los usuarios no se pueden restaurar con su contraseña:
   - **Equipo:** vuelve a crear sus cuentas con `scripts/crear-usuario.mjs`.
   - **Clientes con cuenta:** usan "Olvidé mi contraseña". Al entrar, su cuenta se vuelve a vincular por correo.
   - **Si restauras en un proyecto de Supabase nuevo:** los usuarios tienen otros id. Antes de que entren, corre `update customers set auth_user_id = null;` y borra las filas viejas de `staff`.
