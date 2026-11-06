# Puesta en producción: Kaffa Love · v2.0

Guía paso a paso. El orden es intencional: **primero se prueba todo en Vercel** (incluidos pagos de prueba con Mercado Pago) y **al final** se conecta `kaffalove.cl` para los clientes. Mientras tanto, la tienda PrestaShop sigue funcionando.

Marca cada casilla al completar el paso.

| Fase | Qué se logra | ¿Lo ven los clientes? |
| --- | --- | --- |
| 0. Restaurar el dominio | kaffalove.cl y su correo vuelven a funcionar (PrestaShop) | Sí, la tienda antigua |
| 1. Vercel: ramas y variables | Una URL de pruebas y una de producción | No |
| 2. Acceso y datos del negocio | Administración con retiro, tarifas y contacto | No |
| 3. Pagos de prueba con Mercado Pago | Compras de punta a punta con dinero ficticio | No |
| 4. Correos y tareas automáticas | Correos de confirmación y liberación de reservas | No |
| 5. Ensayo general | Todo probado: tienda, feria, administración | No |
| 6. Lanzamiento con kaffalove.cl | La tienda nueva queda pública | **Sí** |
| 7. Después del lanzamiento | Migración de clientes, Google y limpieza | Sí |

---

## Fase 0 · Restaurar el dominio (urgente)

El 6 de noviembre de 2026 se cambiaron los DNS de kaffalove.cl en NIC.cl a los de Vercel. Como el dominio no está creado en Vercel, esos servidores no responden y **la web y el correo @kaffalove.cl dejaron de funcionar**.

- [ ] **0.1** En [NIC Chile](https://www.nic.cl), entra a tu dominio y cambia los servidores DNS de vuelta a los de Hostinger:
  ```
  ns1.dns-parking.com
  ns2.dns-parking.com
  ```
- [ ] **0.2** Espera entre minutos y unas horas. Comprueba que `https://kaffalove.cl` muestre PrestaShop y que lleguen correos a tus casillas @kaffalove.cl.

> **No vuelvas a cambiar los DNS en NIC.cl.** El DNS se administra en Hostinger, y para el lanzamiento (fase 6) basta con editar dos registros allí. Así el correo nunca se interrumpe.

---

## Fase 1 · Vercel: ramas y variables

Se usan dos ramas de git:

| Rama | Para qué | URL en Vercel |
| --- | --- | --- |
| `master` | Pruebas: aquí se trabaja y se prueba | `https://kaffa-love-git-master-kaffaloveroasters1111-7698.vercel.app` |
| `main` | Producción: lo que verán los clientes | `https://kaffa-love-kaffaloveroasters1111-7698.vercel.app` (y luego `kaffalove.cl`) |

- [ ] **1.1** Crea la rama `main` en GitHub con lo mismo que tiene `master`:
  ```
  git push origin master:main
  ```
- [ ] **1.2** En Vercel, entra a **Settings → Git → Production Branch** y escribe `main`.
- [ ] **1.3** Revisa en **Settings → Deployment Protection** que **Vercel Authentication** esté desactivada. Si está activa, Mercado Pago no puede enviar sus avisos de pago.
- [ ] **1.4** En **Settings → Environment Variables**, carga las variables. Cada una se marca para el entorno que corresponde: **Preview** es la rama `master` y **Production** es `main`.

  | Variable | Preview (pruebas) | Production | Sensitive |
  | --- | --- | --- | --- |
  | `NEXT_PUBLIC_SUPABASE_URL` | el de `.env.local` | igual | No |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | el de `.env.local` | igual | No |
  | `SUPABASE_SECRET_KEY` | el de `.env.local` | igual | Sí |
  | `NEXT_PUBLIC_SITE_URL` | `https://kaffa-love-git-master-kaffaloveroasters1111-7698.vercel.app` | `https://kaffa-love-kaffaloveroasters1111-7698.vercel.app` (en la fase 6 pasa a `https://kaffalove.cl`) | No |
  | `MP_ACCESS_TOKEN` | credencial **de prueba** (fase 3) | credencial **de producción** (fase 6) | Sí |
  | `MP_WEBHOOK_SECRET` | clave de webhooks en modo **prueba** (fase 3) | clave en modo **productivo** (fase 6) | Sí |
  | `CRON_SECRET` | uno al azar | otro al azar | Sí |
  | `RESEND_API_KEY`, `EMAIL_FROM` | fase 4 | fase 4 | Sí / No |
  | `AGENT_API_KEY` | opcional | opcional | Sí |

  Para generar un valor al azar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Nunca** definas `ALLOW_SIMULATED_PAYMENTS` en Vercel.
- [ ] **1.5** Haz **Redeploy** de ambas ramas (las variables solo se aplican en despliegues nuevos). Comprueba que las dos URLs carguen la tienda.

> Las dos ramas usan **la misma base de datos de Supabase**. Las compras de prueba descuentan stock real y consumen números de pedido. Al terminar las pruebas se limpia todo (fase 7).

---

## Fase 2 · Acceso y datos del negocio

- [ ] **2.1** Crea tu usuario administrador (desde la carpeta del proyecto en tu computador):
  ```
  node scripts/crear-usuario.mjs crewxart@gmail.com "Esteban Carvallo" admin
  ```
  La contraseña queda en `.credenciales-crewxart@gmail.com.txt` (git lo ignora). Ingresa en `<URL de pruebas>/ingresar`, cambia la contraseña en **Equipo** y borra ese archivo.
- [ ] **2.2** **Lugares de retiro**: dirección y horario reales (hoy dice "Por definir").
- [ ] **2.3** **Despacho y tienda**: tarifas por región según tu tarifario de Blue Express, correo y WhatsApp de contacto, Instagram. Guarda.
- [ ] **2.4** **Productos**: completa las fichas de los cafés (proceso, variedad y notas de cata; a La Betania le faltan las notas) y sube fotos si ya las tienes.
- [ ] **2.5** **Equipo**: agrega a quienes atenderán la feria con el rol *Operador de feria*.

---

## Fase 3 · Pagos de prueba con Mercado Pago

Todo en la URL de **pruebas** (rama `master`), con dinero ficticio.

- [ ] **3.1** En [Mercado Pago Developers](https://www.mercadopago.cl/developers/panel/app), crea una aplicación de tipo **Checkout Pro** con la cuenta de Kaffa Love.
- [ ] **3.2** En **Credenciales de prueba**, copia el **Access Token** en `MP_ACCESS_TOKEN` del entorno **Preview** de Vercel.
- [ ] **3.3** En **Webhooks → Modo de prueba**, configura:
  - URL: `https://kaffa-love-git-master-kaffaloveroasters1111-7698.vercel.app/api/webhooks/mercadopago`
  - Evento: **Pagos**

  Copia la **clave secreta** que muestra en `MP_WEBHOOK_SECRET` (**Preview**).
- [ ] **3.4** Haz **Redeploy** de la rama `master`.
- [ ] **3.5** En **Cuentas de prueba**, crea un usuario **comprador**. Para pagar en el checkout de prueba debes iniciar sesión con ese usuario y usar las [tarjetas de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
- [ ] **3.6** Prueba estos casos y revisa cada pedido en la administración:
  - [ ] Pago **aprobado** con retiro: el pedido pasa a **Pagado** y aparece en el Resumen.
  - [ ] Pago **aprobado** con despacho: el costo de envío corresponde a la región.
  - [ ] Pago **rechazado** (tarjeta de prueba con nombre de titular `OTHE`): el pedido sigue pendiente y se puede reintentar.
  - [ ] Pagar y **cerrar la ventana** sin volver a la tienda: el pedido igual debe quedar **Pagado** (eso confirma que el webhook funciona).
  - [ ] Dejar un pago sin completar por más de 30 minutos: el pedido pasa a **Expirado** y el stock vuelve (requiere la fase 4.3 o abrir la administración).

---

## Fase 4 · Correos y tareas automáticas

- [ ] **4.1** Correos de la tienda (confirmación de pedido, despacho, retiro y recuperación de contraseña): crea una cuenta en [Resend](https://resend.com) y agrega el dominio `kaffalove.cl`. Resend te pedirá unos registros DNS para un subdominio (por ejemplo `send.kaffalove.cl`): agrégalos en **Hostinger → Dominios → kaffalove.cl → DNS**. Usan un subdominio, así que no afectan el correo ni la web actuales.
- [ ] **4.2** Cuando Resend marque el dominio como verificado, carga `RESEND_API_KEY` y `EMAIL_FROM` (por ejemplo `Kaffa Love <pedidos@kaffalove.cl>`) en Preview y Production, y haz **Redeploy**. Haz una compra de prueba y revisa que llegue el correo.
- [ ] **4.3** Liberación de reservas vencidas cada 5 minutos. Vercel gratis solo la ejecuta una vez al día (ya configurado), así que usa [cron-job.org](https://cron-job.org), que es gratis:
  1. **Create cronjob** con la URL `https://kaffa-love-git-master-kaffaloveroasters1111-7698.vercel.app/api/cron/expirar-reservas` y frecuencia **cada 5 minutos**.
  2. En **Advanced → Headers**, agrega `Authorization` con el valor `Bearer <CRON_SECRET de Preview>`.
  3. Usa **Test run**: debe responder `{"ok":true,...}`.

  En la fase 6 se cambia a la URL y el secreto de producción.

---

## Fase 5 · Ensayo general

- [ ] **5.1** Feria: con un usuario operador, abre una jornada, vende café (con molienda), preparados y una promoción, anula una venta y cierra con el total de Point.
- [ ] **5.2** Administración: prepara, despacha (con número de seguimiento) y entrega un pedido. Cancela otro y revisa que el stock vuelva.
- [ ] **5.3** Carga una compra con la plantilla Excel (**Cargar compras**).
- [ ] **5.4** Revisa la tienda desde tu celular: portada, ficha, carrito, checkout y página del pedido.
- [ ] **5.5** Legal: un asesor revisa **términos**, **cambios y devoluciones** (plazo actual: 10 días) y **privacidad** (`src/app/(tienda)/legal/`).
- [ ] **5.6** El contador confirma la configuración de boletas en Mercado Pago (online y Point).
- [ ] **5.7** Si cambiaste algo en el código, pásalo a producción: `git push origin master:main`.

---

## Fase 6 · Lanzamiento con kaffalove.cl

Hazlo en un horario de pocas ventas. Desde el paso 6.4, PrestaShop deja de verse en kaffalove.cl.

**Credenciales reales**

- [ ] **6.1** En Mercado Pago, copia el **Access Token de producción** en `MP_ACCESS_TOKEN` (**Production**).
- [ ] **6.2** En **Webhooks → Modo productivo**, configura la URL `https://kaffalove.cl/api/webhooks/mercadopago` con el evento **Pagos**, y copia su clave en `MP_WEBHOOK_SECRET` (**Production**).
- [ ] **6.3** Cambia `NEXT_PUBLIC_SITE_URL` (**Production**) a `https://kaffalove.cl` y haz **Redeploy** de `main`.

**Dominio**

- [ ] **6.4** En Vercel, **Settings → Domains → Add**: agrega `kaffalove.cl` y `www.kaffalove.cl` (que `www` redirija a `kaffalove.cl`). Vercel muestra una **IP para el registro A** y un **destino CNAME para `www`**. Anótalos.
- [ ] **6.5** En **Hostinger → Dominios → kaffalove.cl → DNS / Nameservers → Administrar registros DNS**:
  - Registro **A**, nombre `@`: cambia `147.93.14.12` por la IP de Vercel. Si hay un **AAAA** para `@`, bórralo.
  - Registro **CNAME**, nombre `www`: cambia `kaffalove.cl` por el destino de Vercel.
  - **No toques** MX, TXT ni los registros de Resend (son el correo).

  Un día antes, baja el TTL de esos dos registros a 300 para que el cambio sea rápido.
- [ ] **6.6** Espera a que Vercel muestre ambos dominios como **Valid Configuration**. El certificado https se emite solo.
- [ ] **6.7** Actualiza en cron-job.org la URL a `https://kaffalove.cl/api/cron/expirar-reservas` y el secreto al `CRON_SECRET` de **Production**.

**Verificación inmediata**

- [ ] **6.8** Compra real de bajo monto en `https://kaffalove.cl`: debe quedar **Pagado**. Devuélvela desde Mercado Pago.
- [ ] **6.9** Prueba una URL antigua, por ejemplo `https://kaffalove.cl/10-cafe-especialidad`: debe llevar a la categoría nueva.

**Volver atrás si algo falla:** en Hostinger, deja otra vez el registro A en `147.93.14.12` y el CNAME de `www` en `kaffalove.cl`. PrestaShop sigue en Hostinger.

---

## Fase 7 · Después del lanzamiento

- [ ] **7.1** Borra los datos y usuarios de prueba (pedidos de prueba, jornadas `[PRUEBA]`): `node scripts/e2e/limpiar.mjs --usuarios`. Las compras hechas con Mercado Pago de prueba se cancelan desde **Pedidos** (el stock vuelve solo).
- [ ] **7.2** Migra los clientes de PrestaShop y envíales la bienvenida: `scripts/prestashop/README.md`.
- [ ] **7.3** En [Google Search Console](https://search.google.com/search-console), agrega `kaffalove.cl`, envía `https://kaffalove.cl/sitemap.xml` y revisa los errores 404 durante las semanas siguientes.
- [ ] **7.4** Activa los respaldos de Supabase (plan Pro) o exporta la base periódicamente.
- [ ] **7.5** Cuando tengas el logo y los colores definitivos, se cambian en `src/app/globals.css` y `src/components/wordmark.tsx`.
- [ ] **7.6** Mantén PrestaShop unas semanas como respaldo antes de darlo de baja en Hostinger.

---

## Referencia

### Estado del MVP

| Área del PRD | Estado |
| --- | --- |
| Catálogo, fichas, molienda sin preselección, promociones | Listo |
| Carrito y checkout sin cuenta, retiro o despacho, reserva de stock de 30 minutos | Listo |
| Mercado Pago Checkout Pro (webhook verificado contra la API, modo binario) | Listo; credenciales en fases 3 y 6 |
| Despacho | Tarifas por región editables. **API de Blue Express pendiente** (sin credenciales ni documentación verificada). |
| Correos al cliente | Listo; Resend en fase 4 |
| Cuenta opcional después de pagar, historial, "volver a comprar" | Listo |
| Feria con cobro Point confirmado a mano | Listo; integración automática con Point pendiente (permitido por el PRD) |
| Administración completa | Listo |
| Páginas legales | Borrador; revisión en fase 5 |
| Migración PrestaShop: clientes, bienvenida, redirecciones 301 | Listo (`scripts/prestashop/`) |
| API de solo lectura para agentes, SEO | Listo |

### Operación diaria

- **Pagos que requieren atención** (llegaron tarde, duplicados o con monto distinto): aparecen en el Resumen. Revisa el pedido y, si corresponde, devuelve el dinero desde Mercado Pago.
- **Cancelar un pedido pagado** devuelve el stock, pero el dinero se devuelve en Mercado Pago.
- **Pasar cambios a producción**: se trabaja en `master`, se prueba en la URL de pruebas y luego `git push origin master:main`.

### Pruebas automáticas (en tu computador)

Con `npm run dev` corriendo y **sin** `MP_ACCESS_TOKEN` en `.env.local` (usa el pago simulado):

```bash
node scripts/crear-usuario.mjs e2e-admin@kaffalove.test "Admin de Prueba" admin
NEW_USER_PASSWORD=<la del archivo anterior> node scripts/crear-usuario.mjs e2e-operador@kaffalove.test "Operador de Prueba" operador
node scripts/e2e/compra.mjs           # compra online completa (agrega --mobile para celular)
node scripts/e2e/equipo.mjs           # login, permisos, feria y administración
node scripts/e2e/limpiar.mjs --usuarios
```

> No ejecutes `npm run build` con `npm run dev` encendido: ambos usan la carpeta `.next` y el servidor queda recargando en bucle. Si pasa, detenlo, borra `.next` y vuelve a iniciarlo.

### API para agentes

Cabecera `Authorization: Bearer <AGENT_API_KEY>`. Solo lectura, sin correos, teléfonos, nombres ni direcciones exactas.

| Ruta | Contenido |
| --- | --- |
| `GET /api/v1/productos` | Catálogo con stock y contenido de promociones |
| `GET /api/v1/ventas?desde=&hasta=&canal=online\|feria` | Pedidos y ventas de feria con productos y comuna/región |
| `GET /api/v1/eventos?desde=&hasta=&tipo=` | Historial de eventos (`pedido_expirado` = checkout abandonado) |
| `GET /api/v1/clientes` | Historial de compra por cliente (id anónimo y consentimiento) |
