# PRD: Nueva tienda online y venta en feria de Kaffa Love

**Versión:** 0.6 · **Estado:** Borrador para discovery  
**Fecha:** 2026-11-05

## 1. Resumen

Renovar la tienda online de **Kaffa Love**, tostaduría de café de especialidad que hoy opera en PrestaShop/Hostinger, con una tienda atractiva y rápida. Venderá café de especialidad en bolsas de 250 g y productos de cafetería, con precios en pesos chilenos (CLP). El cliente podrá elegir la molienda del café. La tienda debe permitir pagar con Mercado Pago, cotizar envíos con BlueExpress y reutilizar catálogo e inventario en una interfaz sencilla para ferias presenciales, donde también se venderán productos preparados.

El principal dolor del negocio son las ventas. Por eso, la base técnica se diseñará desde el inicio para conectar agentes que ayuden a vender más (sección 10). La primera versión prioriza una tienda que convierta bien; los agentes se suman por etapas, partiendo por los de menor riesgo.

## 2. Contexto actual

- **Marca y plataforma:** Kaffa Love opera hoy en PrestaShop/Hostinger. Se busca renovar el diseño y la experiencia manteniendo el negocio y el dominio activos hasta que la nueva tienda esté probada.
- **Contenido actual:** la tienda ya presenta cafés, alternativas de molienda, cafetería y regalos, y comunica el tueste artesanal y la frescura. Se revisarán esos contenidos para conservar lo valioso en el rediseño.
- **Categorías actuales:** Café de Especialidad (bolsas de 250 g, desde $12.900); Cafetería Hogar (cafeteras manuales como prensa francesa, italiana, V60 y Chemex; molinillos; filtros, balanzas y otros accesorios); Regalos y promociones que combinan productos (por ejemplo, cafetera + tetera); blog con recetas.
- **Identidad de marca:** se mantiene el logo de Kaffa Love. El tono es cálido, cercano y con humor ("café de especialidad, buenas experiencias y risas"). Mensajes clave: café tostado en Chile y semanalmente, frescura real, tueste artesanal en lotes pequeños, trazabilidad y "café con identidad". Referencias: https://instagram.com/kaffaloveroasters11.11 y https://kaffalove.cl. Falta obtener los archivos del logo y la paleta de colores y tipografías.
- **Público prioritario:** consumidor final (B2C) que compra para su casa o para regalar.
- **Feria:** existe una referencia de venta presencial en https://kaffalove.cl/feria que sirve de base para la nueva vista de feria.
- **Integraciones:** el acceso a las cuentas de Mercado Pago/Point y BlueExpress está confirmado. Falta comprobar qué capacidades técnicas ofrecen sus APIs (sección 13).

## 3. Problema y oportunidad

La prioridad del negocio es aumentar las ventas. Hoy se necesita una experiencia de compra que presente bien el café, reduzca pasos y dudas antes del pago y mantenga coherentes los productos y el stock vendidos online y en ferias. Los datos de productos, clientes y pedidos alimentarán agentes que ayuden a descubrir y concretar oportunidades de venta.

## 4. Objetivos

- Facilitar que un visitante encuentre un café apropiado y complete una compra desde móvil o escritorio.
- Habilitar pagos online con Mercado Pago y mostrar opciones/costos de despacho de BlueExpress antes de pagar.
- Gestionar un catálogo y stock común para la tienda y una vista de venta rápida para ferias.
- Registrar pedidos, ventas y cambios de inventario de forma consistente y consultable.
- Migrar desde PrestaShop sin perder ventas ni posicionamiento en buscadores.
- Preparar datos e interfaces para agentes de ventas, manteniendo el sistema entendible y operable por una persona sin experiencia previa en agentes.

## 5. Usuarios principales

- **Comprador/a de café:** quiere elegir con confianza, entender el perfil del café y comprar rápidamente.
- **Operador/a de feria:** necesita encontrar productos, agregarlos al carrito y registrar una venta con pocos toques.
- **Administrador/a de la tienda:** mantiene productos, precios, disponibilidad y pedidos; revisa ventas y resuelve excepciones.

## 6. Alcance del MVP

### Tienda online

- Inicio orientado a descubrir y comprar productos, con identidad visual propia de Kaffa Love.
- Catálogo y fichas de producto con precio en CLP, disponibilidad y descripción útil del café (por ejemplo, origen, proceso, variedad y notas de sabor cuando aplique).
- Cada café se vende en bolsa de 250 g y permite seleccionar molienda: en grano, fina, media o gruesa. La molienda se guarda como opción del pedido; por defecto, todas las moliendas descuentan del stock del mismo café en bolsa.
- El catálogo es variable: la cantidad de orígenes de café (por ejemplo, 3 a la vez) y de accesorios cambia según la temporada. Activar, desactivar o agregar productos debe ser simple y no requerir cambios de código.
- Accesorios de cafetería, como cafeteras, molinillos y filtros, y promociones que combinan productos, disponibles para compra online. Una promoción no tiene stock propio: al venderse descuenta stock de cada producto incluido, y solo está disponible si todos sus productos tienen stock.
- Los productos preparados (americano, espresso, torta, etc.) no se muestran en la tienda online.
- Carrito editable y checkout breve, adaptable a móvil.
- Dos formas de entrega: despacho a domicilio cotizado con BlueExpress antes de confirmar el pedido, o retiro en persona sin costo de envío. El lugar y los horarios de retiro aún no están definidos; se configurarán desde la administración y se mostrarán en el checkout.
- Precios publicados con IVA incluido; el precio ya considera la comisión de Mercado Pago.
- Pago mediante Mercado Pago. Opción inicial recomendada: Checkout Pro para delegar el formulario de pago y reducir complejidad del MVP; confirmar comisiones, experiencia y requisitos de la cuenta antes de decidir.
- Estados de pedido y confirmación de compra; manejo visible de errores o pagos pendientes.
- La boleta de las ventas online la emite Mercado Pago; la aplicación no emite documentos tributarios.
- Páginas legales básicas: términos y condiciones, política de cambios y devoluciones, y política de privacidad. Hoy no existe una política de devoluciones; la base acordada es aceptar accesorios sin uso y en su empaque, y no aceptar café abierto. Definir el plazo y considerar el derecho a retracto en compras a distancia de la Ley del Consumidor; revisarla con un asesor antes de publicar.

### Venta en feria

- Vista de venta rápida inspirada en la referencia: categorías, productos tocables, precios en CLP, indicador de stock, carrito y total de venta del día.
- Vender cafés con la molienda solicitada, accesorios y productos preparados que solo se ofrecen en ferias físicas.
- Registrar la venta y actualizar el stock del catálogo compartido para café y accesorios. Los productos preparados tienen su propio inventario de feria.
- Todas las ventas se cobran con un dispositivo Mercado Pago Point. La persona operadora registra la venta en la aplicación y confirma el cobro en Point; la integración automática con el dispositivo queda sujeta a validar disponibilidad técnica.
- La aplicación no emite boletas; la boleta se obtiene desde Mercado Pago Point.
- Acceso restringido al personal autorizado.

### Administración básica

- Crear y editar productos, precios, variantes y stock.
- Registrar peso y dimensiones de cada producto, necesarios para cotizar despachos.
- Consultar pedidos online y ventas presenciales.
- Ajustar stock con registro de motivo para corregir diferencias.
- Crear promociones eligiendo los productos que incluyen y su precio.
- Configurar lugar y horarios de retiro en persona.
- El administrador mantiene el catálogo y el stock. Deseable: cargar nuevas compras desde una planilla Excel con una plantilla definida. La aplicación muestra una vista previa (productos nuevos, stock que se suma, filas con errores) y el administrador confirma antes de aplicar los cambios.

### Migración desde PrestaShop

- Migrar y comprobar productos, categorías, descripciones, imágenes, precios, variantes y stock.
- Migrar clientes (nombre, correo, teléfono y direcciones). Las contraseñas de PrestaShop no se pueden reutilizar de forma segura; los clientes crearán una nueva con un enlace de bienvenida.
- Migrar el consentimiento de comunicaciones comerciales solo si PrestaShop lo tiene registrado; si no, pedirlo de nuevo.
- No se migran pedidos históricos, cupones ni carritos.
- Preparar redirecciones para las URLs que cambien y conservar títulos y descripciones relevantes para buscadores.

## 7. Fuera del MVP

- Agentes autónomos que cambien precios, contacten clientes o completen compras por su cuenta sin revisión humana.
- Programa de puntos, suscripciones, marketplace, múltiples tiendas o ERP completo.
- Predicción avanzada de demanda y campañas automatizadas multicanal.
- Operación offline en feria; se confirma que el punto de venta tendrá conexión a internet.

## 8. Experiencia y principios de diseño

- La marca, el café y sus productos deben ser protagonistas; diseño cálido y distintivo, no una plantilla genérica.
- Priorizar móvil, carga rápida, lectura fácil y llamadas a la acción claras.
- Reducir pasos y campos en el checkout; pedir solo los datos necesarios para pago y despacho.
- Mostrar precio, disponibilidad y costo/condiciones de despacho antes de que el cliente se comprometa a pagar.
- La vista de feria debe privilegiar velocidad y legibilidad bajo condiciones de uso presencial.

## 9. Requisitos funcionales clave

1. El stock no debe quedar negativo por ventas concurrentes online y presenciales. La molienda es una opción de preparación y no crea inventario separado por defecto. Definir cuándo se reserva stock en compras online (al iniciar el pago o al confirmarlo) y qué pasa con los pagos pendientes.
2. Una orden online solo se considera pagada al confirmarse el estado del pago con Mercado Pago; la página de retorno del navegador no basta como confirmación. En feria, se registra como pagada después de confirmar el cobro en Point.
3. Cada cotización de despacho debe asociarse a una dirección y a los datos físicos del paquete requeridos por el proveedor.
4. Las ventas de feria y las órdenes online deben poder distinguirse y consultarse por fecha.
5. Los datos que se expongan a agentes u otros proyectos deben respetar permisos y consentimiento del cliente; no incluir datos personales innecesarios.

## 10. Agentes de ventas

El objetivo es que los agentes ayuden a vender más, pero se implementan por etapas para aprender sin arriesgar la operación. Regla general: un agente puede **sugerir**; las acciones que afectan a clientes, precios o dinero requieren aprobación humana hasta que se haya probado.

### Fundamentos (dentro del MVP)

- Catálogo, stock, clientes, ventas y pedidos con identificadores y estructura consistente.
- Historial de eventos importantes: pedido creado, pago confirmado, carrito abandonado, venta de feria, cambio de stock y pedido despachado.
- Una API autenticada de solo lectura al inicio, con permisos mínimos, para que agentes y otros proyectos consulten productos y ventas sin acceso directo a la base de datos.
- Consentimiento de comunicaciones comerciales registrado en el checkout, con opción de darse de baja.

### Hoja de ruta propuesta (post-MVP)

| Etapa | Agente | Cómo ayuda a vender | Riesgo |
| --- | --- | --- | --- |
| 1 | Reporte semanal de ventas | Resume ventas por canal, productos estrella, stock bajo y oportunidades | Bajo: solo lee datos |
| 2 | Asistente de compra en la tienda | Recomienda cafés según gustos y método de preparación; responde preguntas frecuentes | Bajo/medio: conversa con clientes, sin cobrar ni cambiar datos |
| 3 | Recuperación de carritos abandonados | Redacta recordatorios personalizados; una persona aprueba antes de enviar | Medio: contacta clientes con consentimiento |
| 4 | Recompra | Detecta clientes que probablemente se quedaron sin café y propone un mensaje u oferta | Medio |

El orden y alcance se revisarán con los datos reales de la tienda una vez en producción.

## 11. Criterios iniciales de éxito

- Conversión de visita a compra y porcentaje de checkout completado.
- Tiempo y cantidad de pasos desde el carrito hasta el pago confirmado.
- Porcentaje de cotizaciones de envío que terminan en compra.
- Ventas, productos vendidos y diferencias de inventario por canal.
- Errores de pago, cotización y pedidos que requieren intervención manual.
- Para cada agente: ventas atribuibles o tiempo ahorrado frente a su costo.

Se establecerán metas numéricas cuando conozcamos el tráfico, volumen de ventas y operación actuales.

## 12. Stack candidato para validar

- **Aplicación:** Next.js + TypeScript para tienda, administración y vista de feria en una sola aplicación web.
- **Datos y servicios:** Supabase (PostgreSQL, autenticación y almacenamiento) para empezar con una base relacional y accesible.
- **Pagos online:** Mercado Pago Checkout Pro. Para feria se usará Mercado Pago Point; confirmar si hay una integración soportada para asociar automáticamente el cobro físico a la venta registrada en la aplicación. La alternativa inicial es confirmación manual por el operador.
- **Despachos:** integración mediante un módulo/adaptador BlueExpress; comprobar capacidades de la API, cobertura, tarifas y etiquetas. Si alguna capacidad no está disponible, acordar una contingencia manual para el MVP.
- **Agentes:** Claude API sobre la API de solo lectura de la tienda, empezando por el reporte semanal.
- **Despliegue:** Vercel para la aplicación y Supabase para datos; revisar costos, región y respaldos antes de producción.

Esto es una propuesta inicial, no una decisión cerrada. La integración con BlueExpress y el flujo de venta de feria pueden modificar el diseño técnico.

## 13. Supuestos

- El negocio opera en Chile, vende en pesos chilenos y la tienda se publica en español. **Confirmado.**
- El catálogo online incluye café en bolsas de 250 g con elección de molienda y productos de cafetería; productos preparados solo se venden en ferias. **Confirmado.**
- La vista de feria tendrá conexión a internet y cobrará con Mercado Pago Point. **Confirmado; validar aparte integración de Point.**
- Las boletas (online y feria) se emiten mediante Mercado Pago; los precios incluyen IVA y la comisión. **Confirmado por el usuario; conviene que el contador valide la configuración.**
- Se migran productos y clientes desde PrestaShop; no pedidos históricos ni cupones. **Confirmado.**
- Se mantiene el logo; el público prioritario es B2C. **Confirmado.**
- Retiro en persona habilitado; lugar y horarios por definir. **Confirmado.**
- Las promociones descuentan stock de cada producto incluido. **Confirmado.**
- El administrador mantiene el catálogo y el stock. **Confirmado.**
- El logo y las fotos de buena calidad se incorporan al final; mientras tanto se diseña con material provisional. **Confirmado.**
- Hay acceso a las cuentas de Mercado Pago/Point y BlueExpress. **Confirmado.** Falta probar que sus APIs permitan cotizar y etiquetar envíos, y asociar cobros de Point a ventas.
- El MVP parte con una sola marca y una ubicación de inventario compartida entre tienda online y feria.

## 14. Preguntas pendientes

1. Lugar y horarios de retiro en persona.
2. Plazo de la política de devoluciones.
3. Archivos del logo, colores, tipografías y fotos de productos (al final del proyecto).

## 15. Próximo paso

Responder las preguntas pendientes y dibujar los flujos principales: compra online y venta en feria. Luego definimos el diseño visual, comprobamos las APIs de BlueExpress y Point, y construimos el MVP por partes pequeñas, probando cada flujo antes de sumar el primer agente de ventas.
