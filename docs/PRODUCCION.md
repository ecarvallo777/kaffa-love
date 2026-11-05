# Puesta en producción: Kaffa Love

Guía para publicar la tienda. Los pasos marcados con **(tú)** necesitan una cuenta o una decisión del negocio. El resto ya está hecho en el código.

## Estado del MVP

| Área del PRD | Estado |
| --- | --- |
| Catálogo, fichas, molienda sin preselección, promociones | Listo |
| Carrito y checkout sin cuenta, con retiro o despacho | Listo |
| Reserva de stock por 30 minutos y expiración | Listo |
| Mercado Pago Checkout Pro, con confirmación por webhook verificada en la API | Listo, **faltan credenciales (tú)** |
| Despacho | Tarifas por región editables (contingencia del PRD). La **API de Blue Express queda pendiente**: no hay credenciales ni documentación verificada. |
| Correos al cliente (confirmación, despacho, retiro) | Listo, **falta Resend (tú)** |
| Cuenta opcional después de pagar, historial y "volver a comprar" | Listo |
| Vista de feria: jornada, venta rápida, cobro con Point confirmado a mano, cierre con cuadre | Listo. La integración automática con Point queda pendiente, como permite el PRD. |
| Administración: pedidos, productos, fotos, stock con motivo, compras desde Excel, retiro, tarifas, ferias, equipo | Listo |
| Páginas legales | Borrador listo, **revisión de un asesor antes de publicar (tú)** |
| Migración de PrestaShop: clientes, bienvenida y redirecciones 301 | Scripts listos (`scripts/prestashop/README.md`) |
| Fundamentos para agentes: eventos y API de solo lectura sin datos personales | Listo (`/api/v1/...`) |
| SEO: sitemap, robots, datos estructurados de producto | Listo |

## 1. Configurar Mercado Pago (tú)

1. En [Mercado Pago Developers](https://www.mercadopago.cl/developers/panel/app), crea una aplicación **Checkout Pro** con la cuenta del negocio.
2. Copia el **Access Token de producción** en `MP_ACCESS_TOKEN`.
3. En **Webhooks**, configura:
   - URL: `https://<tu-dominio>/api/webhooks/mercadopago`
   - Evento: **Pagos**
4. Copia la **clave secreta** que muestra Mercado Pago en `MP_WEBHOOK_SECRET`.
5. Haz una compra real de bajo monto y revisa que el pedido pase a **Pagado** en la administración. Devuélvela desde Mercado Pago.

Si primero quieres probar con credenciales de prueba, usa el Access Token de prueba y los [usuarios de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/accounts) de Mercado Pago.

> Checkout Pro está configurado en **modo binario**: los pagos quedan aprobados o rechazados, sin "pendientes". Así el pago nunca supera la reserva de 30 minutos. Por eso no se ofrecen medios en efectivo como Servipag.

## 2. Publicar en Vercel

1. Sube el repositorio a GitHub e impórtalo en [Vercel](https://vercel.com/new).
2. En **Settings → Environment Variables**, carga todas las variables de `.env.example`.
   - `NEXT_PUBLIC_SITE_URL`: tu dominio final con https.
   - `CRON_SECRET`: genera uno al azar (ver comando en `.env.example`).
   - **No** definas `ALLOW_SIMULATED_PAYMENTS`.
3. `vercel.json` ya fija la región `gru1` (São Paulo), la más cercana a Chile. Conviene que el proyecto de Supabase esté en la misma región.
4. Tarea programada: en el plan Hobby, Vercel solo permite una ejecución diaria, que ya está configurada. Además, las reservas vencidas se liberan cada vez que alguien compra, vende en feria o abre la administración. En el plan Pro, cambia el `schedule` a `*/10 * * * *`.
5. Conecta el dominio `kaffalove.cl` en **Settings → Domains** **solo después de** probar todo en la URL `*.vercel.app`.

## 3. Primer acceso a la administración

```bash
node scripts/crear-usuario.mjs tu@correo.cl "Tu Nombre" admin
```

Las credenciales quedan en `.credenciales-<correo>.txt`, que git ignora. Ingresa en `/ingresar`, cambia la contraseña en **Equipo** y borra ese archivo. Desde **Equipo** puedes agregar operadores de feria.

## 4. Antes de vender (tú)

El **Resumen** de la administración muestra esta lista y marca lo que falta:

- [ ] Credenciales de Mercado Pago y clave del webhook.
- [ ] **Lugares de retiro**: dirección y horario reales. Hoy dice "Por definir".
- [ ] **Despacho y tienda**: revisar las tarifas por región con el tarifario de Blue Express y guardar. Agregar correo y WhatsApp de contacto.
- [ ] Correos con Resend: verificar el dominio y configurar `RESEND_API_KEY` y `EMAIL_FROM`.
- [ ] Revisar con un asesor los **términos**, la **política de cambios** (plazo actual: 10 días) y la **privacidad**. El texto está en `src/app/(tienda)/legal/`.
- [ ] Completar las fichas de los cafés (proceso, variedad, notas de cata; a La Betania le faltan las notas) y subir fotos.
- [ ] Logo, colores y tipografías definitivos: se cambian en `src/app/globals.css` y `src/components/wordmark.tsx`.
- [ ] Borrar los usuarios y datos de prueba: `node scripts/e2e/limpiar.mjs --usuarios`.
- [ ] Confirmar con el contador la configuración de boletas en Mercado Pago (online y Point).

## 5. Migración desde PrestaShop

Sigue `scripts/prestashop/README.md`: importar clientes, enviar la bienvenida y verificar las redirecciones. Mantén PrestaShop activo hasta probar la tienda nueva con pedidos reales. Después cambia el dominio.

## 6. Verificación después de publicar

- [ ] Comprar con retiro y con despacho; aprobar y rechazar pagos.
- [ ] El pedido llega a **Pagado** aunque el cliente cierre la ventana de Mercado Pago (eso confirma que el webhook funciona).
- [ ] Abrir una jornada de feria, vender, anular y cerrar.
- [ ] Revisar `https://<dominio>/sitemap.xml` y enviarlo a Google Search Console.
- [ ] Probar URLs antiguas (por ejemplo `/10-cafe-especialidad`): deben redirigir.

## Pruebas automáticas

Con `npm run dev` corriendo, sin `MP_ACCESS_TOKEN` (pago simulado):

```bash
node scripts/crear-usuario.mjs e2e-admin@kaffalove.test "Admin de Prueba" admin
NEW_USER_PASSWORD=<la misma del archivo anterior> node scripts/crear-usuario.mjs e2e-operador@kaffalove.test "Operador de Prueba" operador
node scripts/e2e/compra.mjs     # compra online completa
node scripts/e2e/equipo.mjs     # login, permisos, feria y administración
node scripts/e2e/limpiar.mjs    # borra pedidos y movimientos de prueba
```

Las capturas quedan en `e2e-output/`.

> No ejecutes `npm run build` con `npm run dev` encendido: ambos escriben en `.next` y el servidor de desarrollo puede quedar recargando en bucle. Si pasa, detén el servidor, borra la carpeta `.next` y vuelve a iniciarlo.

## Operación

- **Pagos que requieren atención** (llegaron tarde, duplicados o con monto distinto): aparecen en el Resumen. Revisa el pedido y, si corresponde, devuelve el dinero desde Mercado Pago.
- **Cancelar un pedido pagado** devuelve el stock, pero la devolución del dinero se hace en Mercado Pago.
- **Respaldos**: activa los respaldos automáticos de Supabase (plan Pro), o exporta la base periódicamente.

## API para agentes

Todas las rutas usan la cabecera `Authorization: Bearer <AGENT_API_KEY>`. Son de solo lectura y no entregan correos, teléfonos, nombres ni direcciones exactas.

| Ruta | Contenido |
| --- | --- |
| `GET /api/v1/productos` | Catálogo con stock y contenido de promociones |
| `GET /api/v1/ventas?desde=&hasta=&canal=online\|feria` | Pedidos y ventas de feria con sus productos y comuna/región |
| `GET /api/v1/eventos?desde=&hasta=&tipo=` | Historial de eventos (`pedido_expirado` = checkout abandonado) |
| `GET /api/v1/clientes` | Historial de compra por cliente (id anónimo y consentimiento) |
