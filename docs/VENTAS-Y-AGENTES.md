# Cómo vender más: automatizaciones y agentes

**Versión:** 1.0 · 7 de noviembre de 2026 · Complementa la sección 10 del [PRD](PRD.md)

La tienda ya registra cada hecho importante (pedidos, pagos, carritos que vencieron, ventas de feria), conoce a sus clientes (con consentimiento de novedades) y tiene recetas por café. Eso es la materia prima para vender más. Dos capas: **automatizaciones simples** (sin IA) y **agentes con IA** encima.

## Capa cero: atraer clientes nuevos

Antes de recuperar carritos o pedir recompras, alguien tiene que llegar a la tienda y confiar en ella. Para una tostadora que ya vende en ferias, en orden de impacto:

1. **De la feria a la tienda online (lo primero).** La feria es el mejor canal: la gente prueba el café y le gusta, pero la venta termina en el stand.
   - **Tarjeta con QR** en cada bolsa y en el stand, con descuento en la primera compra online.
   - **Automatización:** al usar el código, el cliente recibe una bienvenida y queda dentro de recompra y carrito abandonado.
   - **Automatización:** publicar cada semana "dónde estaremos este fin de semana", armado desde las jornadas de feria ya cargadas.
2. **Que Google te encuentre (gratis y acumulativo).**
   - **Google Shopping gratis (Merchant Center):** feed de productos generado solo desde el catálogo.
   - **Perfil de empresa en Google**, con fotos y reseñas.
   - **Recetas como páginas propias:** responden lo que la gente busca ("cómo preparar café en V60", "molienda para prensa francesa").
   - **Agente de SEO:** cada semana revisa las búsquedas en Search Console y propone qué guía o receta escribir; una persona aprueba.
3. **Instagram con constancia, sin que consuma el día.**
   - **El mismo feed del catálogo para la tienda de Instagram**, así los posts tienen etiquetas de producto.
   - **Agente de contenido:** redacta posts e historias desde las notas de cata, los lotes nuevos, las recetas y la agenda de ferias; una persona revisa y publica.
4. **Que los clientes traigan clientes.**
   - **Pedido automático de reseñas** unos días después de la entrega, en Google y en la ficha del producto.
   - **Referidos:** "regala $3.000 y recibe $3.000", con un enlace propio para cada cliente.
5. **Publicidad pagada (después, con datos).** Con poco presupuesto en Meta: remarketing a quien vio un producto y no compró, y anuncios del catálogo en Santiago. No antes de tener datos del embudo.

**Medición:** cada canal con su enlace etiquetado (QR de feria, Instagram, Google), para que **Reportes** muestre de dónde viene cada venta.

**Primer mes después del lanzamiento:** QR de feria con bienvenida, Google Shopping gratis y perfil de Google, pedido de reseñas y enlaces etiquetados. Todo gratis. Los agentes de contenido y SEO vienen después, cuando haya un ritmo.

## Primera capa: automatizaciones de alto impacto

1. **Recompra (la más importante).** Una bolsa de 250 g dura unas 2 a 3 semanas. A los ~18 días de cada compra: *"¿Se te está acabando el Caicedo? Repítelo con un clic"*, con enlace a "volver a comprar".
2. **Carrito abandonado.** Cada reserva vencida queda como `pedido_expirado`. Si el cliente aceptó novedades, una hora después recibe *"Tu café te está esperando"* con su carrito listo. Suele recuperar entre 5 y 15 % de los abandonos.
3. **Secuencia post-compra.** Día 3: la receta del café comprado (con temporizador). Día 10: *"¿Cómo te quedó? Comparte tu taza y etiquétanos"*.
4. **De la feria a la tienda.** Código QR en el stand con descuento en la primera compra online; captura el correo y convierte al cliente de feria en cliente recurrente.
5. **Subir el ticket.** Despacho gratis desde un monto y, en el carrito: *"Te faltan $3.200 para el despacho gratis: ¿agregas filtros?"*. Sugerir el método o filtro de la receta del café que se compra.
6. **Escasez real.** "Quedan 3" ya existe; sumar "lote de temporada" y "Avísame cuando vuelva" en cafés agotados.

### Estado (9 de noviembre de 2026)

- ✅ **Medición:** Vercel Analytics y embudo anónimo en **Reportes** (vio producto, agregó al carrito, llegó al pago, pagó).
- ✅ **Carrito abandonado** y **recompra** (configurables en **Configuración → Correos automáticos**; días de recompra ajustables). Una vez por pedido, nunca si el cliente ya volvió a comprar, con enlace "Retomar mi compra" que rearma el carrito y baja en un clic. Resultados (enviados, clics, compras y ventas) en **Reportes**.
- ✅ **Ventas por canal:** cada visita recuerda por 30 días de dónde llegó (enlace con `?utm_source=`, o Google, Instagram, Facebook o WhatsApp según el sitio de origen) y cada pedido lo guarda. **Reportes → De dónde llegan los clientes** muestra visitantes, pedidos pagados y ventas por canal. Los correos automáticos llegan etiquetados como «Correos».
- ✅ **Feed de productos** para Google Shopping e Instagram en `/feed/productos.xml` (con `?canal=instagram` para Meta): falta conectarlo en Merchant Center y Meta, y subir fotos (sin foto no se publica).
- ✅ **Subir el ticket:** barra de despacho gratis (aparece al definir el monto en Configuración) y hasta 3 sugerencias en el carrito, primero las que completan el despacho gratis.
- ⏳ Secuencia post-compra, QR de feria y "Avísame cuando vuelva": después del lanzamiento.
- ⏳ Agentes con IA: después del lanzamiento, cuando haya datos del embudo.
- ⏳ Capa cero (atraer clientes): primer mes después del lanzamiento.

## Segunda capa: agentes con IA

Regla del PRD: los agentes **sugieren**, una persona **aprueba**. Se conectan a la API de solo lectura `/api/v1` (sin datos personales).

| # | Agente | Qué hace | Cómo ayuda a vender | Riesgo |
| --- | --- | --- | --- | --- |
| 1 | Reporte semanal | Cada lunes analiza ventas, ferias, stock y abandonos y envía 3 acciones concretas | Decisiones con datos sin abrir planillas | Bajo |
| 2 | Barista virtual | Chat en la tienda: recomienda café, molienda y receta según método y gustos, y agrega al carrito | Resuelve la duda que frena la compra, 24/7 | Bajo-medio |
| 3 | Recuperación personalizada | Redacta correos de carrito abandonado y recompra según lo que compró cada cliente; tú apruebas desde una cola | Mensajes que no parecen masivos | Medio |
| 4 | Planificador de feria | Con el historial por lugar y día, sugiere cuánto llevar y si conviene repetir la feria según su utilidad real | Menos quiebres y menos ferias con pérdida | Bajo |
| 5 | Contenido | Redacta fichas, posts de Instagram y correos de lanzamiento desde notas de cata y recetas | Más presencia con el mismo tiempo | Bajo |
| 6 | WhatsApp de atención | Responde dudas frecuentes (envíos, moliendas, estado del pedido) y deriva lo complejo | Responde cuando el cliente está decidiendo | Medio |

## Orden sugerido

1. **Medir:** Vercel Analytics (gratis) y eventos "vio producto", "agregó al carrito", "inició checkout". Sin esto no se sabe qué funciona.
2. **Recompra y carrito abandonado** (automatizaciones 1 y 2): mayor retorno, usan lo que ya existe.
3. **Reporte semanal** (agente 1), sobre el dashboard de ventas.
4. **Barista virtual** (agente 2): ya están las notas de cata, recetas por molienda y stock.

**Costos aproximados:** automatizaciones gratis (Resend y Vercel); un agente con la API de Claude cuesta unos pocos dólares al mes al volumen actual.
