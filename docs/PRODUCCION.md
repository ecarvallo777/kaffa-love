# Puesta en producción: Kaffa Love · v2.0

Guía paso a paso. El orden es intencional: **primero se prueba todo en Vercel** (incluidos pagos de prueba con Mercado Pago), **después** se conecta `kaffalove.cl` para los clientes y **al final** se cancela Hostinger. Mientras tanto, la tienda PrestaShop y el correo siguen funcionando.

**Dónde queda cada cosa al terminar** (sin Hostinger):

| Función | Antes | Después | Costo |
| --- | --- | --- | --- |
| Dominio | NIC.cl | NIC.cl (sin cambios) | Renovación anual de NIC |
| DNS | Hostinger | **Vercel DNS** | Gratis |
| Tienda | PrestaShop en Hostinger | **Vercel** + Supabase | Gratis (planes Hobby / Free) |
| Recibir correo @kaffalove.cl | Hostinger | **ImprovMX** → reenvía a Gmail | Gratis |
| Enviar correo @kaffalove.cl | Hostinger | **Gmail "Enviar como"** vía SMTP de **Resend** | Gratis (hasta 3.000 correos/mes) |
| Correos de la tienda | — | **Resend** | Gratis (mismo límite) |

Marca cada casilla al completar el paso.

| Fase | Qué se logra | ¿Lo ven los clientes? |
| --- | --- | --- |
| 0. DNS en Vercel | kaffalove.cl y su correo vuelven a funcionar (PrestaShop), ya sin depender del DNS de Hostinger | Sí, la tienda antigua |
| 1. Vercel: ramas y variables | Una URL de pruebas y una de producción | No |
| 2. Acceso y datos del negocio | Administración con retiro, tarifas y contacto | No |
| 3. Pagos de prueba con Mercado Pago | Compras de punta a punta con dinero ficticio | No |
| 4. Correos y tareas automáticas | Correos de confirmación y liberación de reservas | No |
| 5. Ensayo general | Todo probado: tienda, feria, administración | No |
| 6. Lanzamiento con kaffalove.cl | La tienda nueva queda pública | **Sí** |
| 7. Después del lanzamiento | Migración de clientes, Google y limpieza | Sí |
| 8. Salir de Hostinger | Correo migrado, respaldo de PrestaShop y membresía cancelada | Sí |

---

## Fase 0 · DNS en Vercel ✅ (completada el 6 de noviembre de 2026)

El 6 de noviembre de 2026 se cambiaron los DNS de kaffalove.cl en NIC.cl a los de Vercel (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`). Eso **se mantiene**: es el primer paso para salir de Hostinger. Pero como el dominio aún no está creado en Vercel, esos servidores no responden y **la web y el correo @kaffalove.cl están caídos**. Se arregla creando el dominio en Vercel y copiando allí los registros que hoy tiene Hostinger, para que todo siga igual mientras se prueba.

- [x] **0.1** Copia la lista de registros DNS actuales desde **Hostinger (hPanel) → Dominios → kaffalove.cl → DNS / Nameservers → Registros DNS**. Hostinger la conserva aunque ya no esté en uso. Interesan sobre todo: **A**, **CNAME**, **MX**, **TXT** (SPF y DMARC) y los registros de firma del correo (DKIM, suelen llamarse `hostingermail-a._domainkey`, `-b` y `-c`). Una captura de pantalla sirve.
- [x] **0.2** En Vercel, entra a la pestaña **Domains** de tu cuenta (no la del proyecto) y agrega `kaffalove.cl` **sin asignarlo al proyecto** todavía. Así Vercel responde por el dominio sin publicar la tienda nueva.
- [x] **0.3** En ese dominio, abre **DNS Records** y crea estos 13 registros (copiados de la zona de Hostinger el 6 de noviembre de 2026). En Vercel, el **Name** va **vacío** para el dominio principal (lo que Hostinger muestra como `@`), y los valores TXT van **sin comillas**:

  | # | Tipo | Name | Valor | Prioridad | Para qué |
  | --- | --- | --- | --- | --- | --- |
  | 1 | A | *(vacío)* | `147.93.14.12` | | Web PrestaShop |
  | 2 | AAAA | *(vacío)* | `2a02:4780:13:1945:0:270d:adde:2` | | Web PrestaShop (IPv6) |
  | 3 | CNAME | `www` | `kaffalove.cl` | | www |
  | 4 | A | `ftp` | `147.93.14.12` | | FTP de Hostinger |
  | 5 | MX | *(vacío)* | `mx1.hostinger.com` | 5 | Recibir correo |
  | 6 | MX | *(vacío)* | `mx2.hostinger.com` | 10 | Recibir correo |
  | 7 | TXT | *(vacío)* | `v=spf1 include:_spf.mail.hostinger.com ~all` | | Autoriza el envío de correo |
  | 8 | TXT | `_dmarc` | `v=DMARC1; p=none` | | Política de correo |
  | 9 | CNAME | `hostingermail-a._domainkey` | `hostingermail-a.dkim.mail.hostinger.com` | | Firma del correo |
  | 10 | CNAME | `hostingermail-b._domainkey` | `hostingermail-b.dkim.mail.hostinger.com` | | Firma del correo |
  | 11 | CNAME | `hostingermail-c._domainkey` | `hostingermail-c.dkim.mail.hostinger.com` | | Firma del correo |
  | 12 | CNAME | `autodiscover` | `autodiscover.mail.hostinger.com` | | Configuración automática del correo (Outlook) |
  | 13 | CNAME | `autoconfig` | `autoconfig.mail.hostinger.com` | | Configuración automática del correo (Thunderbird, celular) |

  El TTL puede quedar en el valor que propone Vercel.

- [x] **0.4** Espera unos minutos y comprueba que `https://kaffalove.cl` muestre PrestaShop y que lleguen y salgan correos de tus casillas @kaffalove.cl.

> **Desde ahora el DNS se administra solo en Vercel.** No vuelvas a cambiar los DNS en NIC.cl, y no edites registros en Hostinger (ya no tienen efecto).

---

## Fase 1 · Vercel: ramas y variables ✅

Se usan dos ramas de git:

| Rama | Para qué | URL en Vercel |
| --- | --- | --- |
| `master` | Pruebas: aquí se trabaja y se prueba | `https://kaffa-love-git-master-kaffaloveroasters1111-7698.vercel.app` |
| `main` | Producción: lo que verán los clientes | `https://kaffa-love-kaffaloveroasters1111-7698.vercel.app` (y luego `kaffalove.cl`) |

- [x] **1.1** Crea la rama `main` en GitHub con lo mismo que tiene `master`:
  ```
  git push origin master:main
  ```
- [x] **1.2** En Vercel, entra a **Settings → Environments → Production → Branch Tracking** y elige `main`. Luego, en **Deployments**, promueve el último despliegue de `main` a producción (**⋯ → Promote to Production**).
- [x] **1.3** Revisa en **Settings → Deployment Protection** que **Vercel Authentication** esté desactivada. Si está activa, Mercado Pago no puede enviar sus avisos de pago.
- [x] **1.4** En **Settings → Environment Variables**, carga las variables. Cada una se marca para el entorno que corresponde: **Preview** es la rama `master` y **Production** es `main`.

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
- [x] **1.5** Haz **Redeploy** de ambas ramas (las variables solo se aplican en despliegues nuevos). Comprueba que las dos URLs carguen la tienda.

> Las dos ramas usan **la misma base de datos de Supabase**. Las compras de prueba descuentan stock real y consumen números de pedido. Al terminar las pruebas se limpia todo (fase 7).

---

## Fase 2 · Acceso y datos del negocio

- [x] **2.1** Crea tu usuario administrador (desde la carpeta del proyecto en tu computador):
  ```
  node scripts/crear-usuario.mjs crewxart@gmail.com "Esteban Carvallo" admin
  ```
  La contraseña queda en `.credenciales-crewxart@gmail.com.txt` (git lo ignora). Ingresa en `<URL de pruebas>/ingresar`, cambia la contraseña en **Equipo** y borra ese archivo.
- [x] **2.2** **Lugares de retiro**: dirección y horario reales (hoy dice "Por definir").
- [ ] **2.3** *(pendiente: se completa antes de la fase 6)* **Despacho y tienda**: tarifas por región según tu tarifario de Blue Express, correo y WhatsApp de contacto, Instagram. Guarda.
- [ ] **2.4** *(pendiente: se completa antes de la fase 6)* **Productos**: completa las fichas de los cafés (proceso, variedad y notas de cata; a La Betania le faltan las notas) y sube fotos si ya las tienes.
- [ ] **2.5** *(pendiente)* **Equipo**: agrega a quienes atenderán la feria con el rol *Operador de feria*.

---

## Fase 3 · Pagos de prueba con Mercado Pago ✅

Todo en la URL de **pruebas** (rama `master`), con dinero ficticio.

- [x] **3.1** En [Mercado Pago Developers](https://www.mercadopago.cl/developers/panel/app), crea una aplicación de tipo **Checkout Pro** con la cuenta de Kaffa Love.
- [x] **3.2** En **Credenciales de prueba**, copia el **Access Token** en `MP_ACCESS_TOKEN` del entorno **Preview** de Vercel.
- [x] **3.3** En **Webhooks → Modo de prueba**, configura:
  - URL: `https://kaffa-love-git-master-kaffaloveroasters1111-7698.vercel.app/api/webhooks/mercadopago`
  - Evento: **Pagos**

  Copia la **clave secreta** que muestra en `MP_WEBHOOK_SECRET` (**Preview**).
- [x] **3.4** Haz **Redeploy** de la rama `master` (o un `git push origin master`).
- [x] **3.4b** En **Webhooks → Modo de prueba**, usa **Simular notificación** (evento Pagos). Debe responder **200**. Si responde **401**, la clave de `MP_WEBHOOK_SECRET` (Preview) no coincide con la del panel.
- [x] **3.5** En **Cuentas de prueba**, crea un usuario **comprador**. Para pagar en el checkout de prueba debes iniciar sesión con ese usuario y usar las [tarjetas de prueba](https://www.mercadopago.cl/developers/es/docs/checkout-pro/additional-content/your-integrations/test/cards).
- [x] **3.6** Prueba estos casos y revisa cada pedido en la administración:

  > Resultado del 6 de noviembre de 2026: en **modo de prueba**, Mercado Pago **no envía avisos** de los pagos (la simulación del panel sí llega con 200). Los pagos se confirman al volver a la tienda o, si se cierra la ventana, con la **conciliación** (busca pagos aprobados en la API de Mercado Pago), que corre en la tarea de la fase 4.3, al abrir la administración y al abrir la página del pedido. Con credenciales reales (fase 6) los avisos llegan normalmente.

  - [x] Pago **aprobado** con retiro: el pedido pasa a **Pagado** y aparece en el Resumen.
  - [x] Pago **aprobado** con despacho: el costo de envío corresponde a la región.
  - [x] Pago **rechazado** (tarjeta de prueba con nombre de titular `OTHE`): el pedido sigue pendiente y se puede reintentar.
  - [x] Pagar y **cerrar la ventana** sin volver a la tienda: el pedido igual debe quedar **Pagado** (eso confirma que el webhook funciona).
  - [x] Dejar un pago sin completar por más de 30 minutos: el pedido pasa a **Expirado** y el stock vuelve (requiere la fase 4.3 o abrir la administración).

---

## Fase 4 · Correos y tareas automáticas

- [ ] **4.1** Correos de la tienda (confirmación de pedido, despacho, retiro y recuperación de contraseña): crea una cuenta en [Resend](https://resend.com) y agrega el dominio `kaffalove.cl`. Resend te pedirá unos registros DNS (DKIM y un subdominio de envío como `send.kaffalove.cl`): agrégalos en **Vercel → Domains → kaffalove.cl → DNS Records**. No afectan el correo ni la web actuales. Esta misma cuenta se usará en la fase 8 para enviar correos desde Gmail.
- [ ] **4.2** Cuando Resend marque el dominio como verificado, carga `RESEND_API_KEY` y `EMAIL_FROM` (por ejemplo `Kaffa Love <pedidos@kaffalove.cl>`) en Preview y Production, y haz **Redeploy**. Haz una compra de prueba y revisa que llegue el correo.
- [ ] **4.3** **Importante.** Tarea cada 5 minutos que confirma pagos cuyo aviso no llegó y libera reservas vencidas. Vercel gratis solo la ejecuta una vez al día (ya configurado), así que usa [cron-job.org](https://cron-job.org), que es gratis:
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

**Requisitos pendientes de la fase 2**

- [ ] **6.0** Tarifas de despacho revisadas y guardadas (2.3), fichas de café completas (2.4) y operadores de feria creados (2.5).

**Credenciales reales**

- [ ] **6.1** En Mercado Pago, copia el **Access Token de producción** en `MP_ACCESS_TOKEN` (**Production**).
- [ ] **6.2** En **Webhooks → Modo productivo**, configura la URL `https://kaffalove.cl/api/webhooks/mercadopago` con el evento **Pagos**, y copia su clave en `MP_WEBHOOK_SECRET` (**Production**).
- [ ] **6.3** Cambia `NEXT_PUBLIC_SITE_URL` (**Production**) a `https://kaffalove.cl` y haz **Redeploy** de `main`.

**Dominio**

- [ ] **6.4** En **Vercel → Domains → kaffalove.cl → DNS Records**, borra los registros **1, 2 y 3** de la fase 0 (el **A** y el **AAAA** del dominio principal, que apuntan a Hostinger, y el **CNAME** de `www`). **No toques** los de correo (MX, TXT, DKIM, autodiscover, autoconfig) ni los de Resend.
- [ ] **6.5** En el proyecto, **Settings → Domains → Add**: agrega `kaffalove.cl` y `www.kaffalove.cl`. **Desmarca** «Redirect apex domains to www»: la tienda usa `https://kaffalove.cl` sin www, así que `www` debe redirigir a `kaffalove.cl`. Elige el entorno **Production**. Como el DNS ya está en Vercel, la conexión es automática.
- [ ] **6.6** Espera a que ambos dominios aparezcan como **Valid Configuration**. El certificado https se emite solo, en minutos.
- [ ] **6.7** Actualiza en cron-job.org la URL a `https://kaffalove.cl/api/cron/expirar-reservas` y el secreto al `CRON_SECRET` de **Production**.

**Verificación inmediata**

- [ ] **6.8** Compra real de bajo monto en `https://kaffalove.cl`: debe quedar **Pagado**. Devuélvela desde Mercado Pago.
- [ ] **6.9** Prueba una URL antigua, por ejemplo `https://kaffalove.cl/10-cafe-especialidad`: debe llevar a la categoría nueva.

**Volver atrás si algo falla:** quita `kaffalove.cl` y `www` del proyecto (**Settings → Domains**) y vuelve a crear en **DNS Records** el registro A `147.93.14.12` y el CNAME `www → kaffalove.cl`. PrestaShop sigue en Hostinger hasta la fase 8.

---

## Fase 7 · Después del lanzamiento

- [ ] **7.1** Borra los datos y usuarios de prueba (pedidos de prueba, jornadas `[PRUEBA]`): `node scripts/e2e/limpiar.mjs --usuarios`. Las compras hechas con Mercado Pago de prueba se cancelan desde **Pedidos** (el stock vuelve solo).
- [ ] **7.2** Migra los clientes de PrestaShop y envíales la bienvenida: `scripts/prestashop/README.md`.
- [ ] **7.3** En [Google Search Console](https://search.google.com/search-console), agrega `kaffalove.cl`, envía `https://kaffalove.cl/sitemap.xml` y revisa los errores 404 durante las semanas siguientes.
- [ ] **7.4** Activa los respaldos de Supabase (plan Pro) o exporta la base periódicamente.
- [ ] **7.5** Cuando tengas el logo y los colores definitivos, se cambian en `src/app/globals.css` y `src/components/wordmark.tsx`.

---

## Fase 8 · Salir de Hostinger

Deja pasar **2 a 4 semanas** desde el lanzamiento, por si hay que volver a PrestaShop.

**Correo: recibir en Gmail**

- [ ] **8.1** Crea una cuenta gratuita en [ImprovMX](https://improvmx.com) con el dominio `kaffalove.cl`. Crea un alias por cada casilla que usas (por ejemplo `hola@kaffalove.cl`), y uno *catch-all* (`*`) si quieres recibir cualquier dirección. Todos reenvían a tu Gmail.
- [ ] **8.2** **Antes de cambiar nada**, respalda los correos antiguos de Hostinger. Por ejemplo, con [Thunderbird](https://www.thunderbird.net): conecta la casilla por IMAP y copia las carpetas a "Carpetas locales". Haz lo mismo con cada casilla.
- [ ] **8.3** En **Vercel → Domains → kaffalove.cl → DNS Records**:
  - Borra los dos **MX** de Hostinger y crea `mx1.improvmx.com` (prioridad 10) y `mx2.improvmx.com` (prioridad 20).
  - Cambia el **TXT de SPF** a `v=spf1 include:spf.improvmx.com ~all`.
  - Borra los registros de correo de Hostinger: DKIM (`hostingermail-a/b/c._domainkey`), `autodiscover` y `autoconfig` (registros 9 a 13 de la fase 0). **No toques** los de Resend ni el `_dmarc`.
- [ ] **8.4** Espera a que ImprovMX marque el dominio como activo y envíate un correo de prueba a `hola@kaffalove.cl`: debe llegar a tu Gmail.

**Correo: enviar como @kaffalove.cl desde Gmail**

- [ ] **8.5** En Resend, crea una **API key** solo para Gmail (*Sending access*).
- [ ] **8.6** En Gmail, ve a **Configuración → Cuentas e importación → Enviar como → Añadir otra dirección**:
  - Nombre: `Kaffa Love`. Correo: `hola@kaffalove.cl`. Desmarca "Tratar como un alias".
  - Servidor SMTP: `smtp.resend.com`, puerto `465`, conexión **SSL**.
  - Usuario: `resend`. Contraseña: la API key del paso 8.5.
  - Gmail envía un código de confirmación a `hola@kaffalove.cl`, que te llega por ImprovMX. Ingrésalo.
- [ ] **8.7** Envía un correo de prueba a otra cuenta y revisa que el remitente sea `hola@kaffalove.cl` y que no caiga en spam.

**Cancelar**

- [ ] **8.8** Respalda PrestaShop: desde hPanel, descarga una copia de los archivos y de la base de datos (Respaldos). Guárdala por si necesitas consultar pedidos antiguos.
- [ ] **8.9** Borra el registro `ftp` (registro 4 de la fase 0) y cualquier otro que todavía apunte a Hostinger (`147.93.14.12`, `2a02:4780:…` o `*.hostinger.com`).
- [ ] **8.10** Cancela la membresía de Hostinger. Revisa antes que **el dominio no esté registrado en Hostinger** (está en NIC.cl, así que no debería verse afectado).

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
