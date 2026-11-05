# Migración desde PrestaShop

## 1. Productos y categorías

El catálogo actual ya está cargado en Supabase (`supabase/seed.sql`, tomado de kaffalove.cl). Para productos nuevos o cambios de stock usa **Administración → Cargar compras** con la plantilla Excel, y sube las fotos en cada producto.

## 2. Clientes

En el administrador de PrestaShop:

1. **Clientes → Clientes → Exportar** (botón de la tabla). Guarda el CSV como `clientes.csv`.
2. **Clientes → Direcciones → Exportar**. Guarda el CSV como `direcciones.csv`.

Luego, en esta carpeta del proyecto:

```bash
# Simulación: muestra qué se importaría, sin guardar nada
node scripts/prestashop/importar-clientes.mjs clientes.csv direcciones.csv

# Importar
node scripts/prestashop/importar-clientes.mjs clientes.csv direcciones.csv --aplicar
```

- Los clientes quedan con `source = 'prestashop'`.
- El consentimiento de novedades **solo** se migra si PrestaShop tiene la suscripción con fecha. Si no, queda sin consentimiento, como pide el PRD.
- Las contraseñas de PrestaShop **no** se migran.
- No se migran pedidos históricos, cupones ni carritos.

Si las columnas de tu exportación tienen otros nombres, ajusta los `pick(...)` del script.

## 3. Correo de bienvenida

Cuando la tienda nueva esté publicada y los correos configurados (`RESEND_API_KEY`, `EMAIL_FROM`):

```bash
node scripts/prestashop/enviar-bienvenida.mjs           # lista destinatarios
node scripts/prestashop/enviar-bienvenida.mjs --enviar  # envía
```

Cada cliente recibe un enlace para crear su contraseña en `/cuenta/nueva-clave`. Comprar sin cuenta sigue siendo posible.

## 4. Redirecciones (SEO)

`src/redirects.json` redirige con 301 las URLs de PrestaShop a las nuevas páginas. Se construyó recorriendo kaffalove.cl en noviembre de 2026:

- Categorías: `/10-cafe-especialidad` → `/categoria/cafe-de-especialidad`, etc.
- Productos: `/{categoría}/{id}-{nombre}.html` (incluye variantes `{id}-{combinación}-…`) → `/producto/{slug}`.
- Productos que ya no existen → su categoría.
- Blog → inicio (el blog de recetas no está en el MVP).

Si agregas productos antes de migrar, añade su línea con el id de PrestaShop. Después del cambio de dominio, revisa en Google Search Console que no haya errores 404.
