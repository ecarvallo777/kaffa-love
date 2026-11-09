# Cómo vender más: automatizaciones y agentes

**Versión:** 1.0 · 7 de noviembre de 2026 · Complementa la sección 10 del [PRD](PRD.md)

La tienda ya registra cada hecho importante (pedidos, pagos, carritos que vencieron, ventas de feria), conoce a sus clientes (con consentimiento de novedades) y tiene recetas por café. Eso es la materia prima para vender más. Dos capas: **automatizaciones simples** (sin IA) y **agentes con IA** encima.

## Primera capa: automatizaciones de alto impacto

1. **Recompra (la más importante).** Una bolsa de 250 g dura unas 2 a 3 semanas. A los ~18 días de cada compra: *"¿Se te está acabando el Caicedo? Repítelo con un clic"*, con enlace a "volver a comprar".
2. **Carrito abandonado.** Cada reserva vencida queda como `pedido_expirado`. Si el cliente aceptó novedades, una hora después recibe *"Tu café te está esperando"* con su carrito listo. Suele recuperar entre 5 y 15 % de los abandonos.
3. **Secuencia post-compra.** Día 3: la receta del café comprado (con temporizador). Día 10: *"¿Cómo te quedó? Comparte tu taza y etiquétanos"*.
4. **De la feria a la tienda.** Código QR en el stand con descuento en la primera compra online; captura el correo y convierte al cliente de feria en cliente recurrente.
5. **Subir el ticket.** Despacho gratis desde un monto y, en el carrito: *"Te faltan $3.200 para el despacho gratis: ¿agregas filtros?"*. Sugerir el método o filtro de la receta del café que se compra.
6. **Escasez real.** "Quedan 3" ya existe; sumar "lote de temporada" y "Avísame cuando vuelva" en cafés agotados.

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
