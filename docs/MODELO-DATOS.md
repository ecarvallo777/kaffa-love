# Modelo de datos: Kaffa Love

**Versión:** 0.1 · SQL en [supabase/migrations/20261105000000_modelo_inicial.sql](../supabase/migrations/20261105000000_modelo_inicial.sql)

La tienda online, la feria y los futuros agentes usan esta misma base de datos.

## Tablas

| Tabla | Qué guarda |
| --- | --- |
| `categories` | Categorías y subcategorías (Café, Cafetería Hogar > Cafeteras, etc.). |
| `products` | Todo lo que se vende. El campo `type` indica si es **café**, **accesorio**, **promoción** o **preparado**. Incluye precio con IVA, stock, ficha del café (origen, proceso, variedad, notas) y peso/medidas para cotizar despachos. |
| `bundle_items` | Qué productos incluye cada promoción y en qué cantidad. |
| `customers` | Clientes: correo, nombre, teléfono, si aceptó recibir novedades y si vienen de PrestaShop. |
| `addresses` | Direcciones de despacho de cada cliente. |
| `pickup_locations` | Lugares y horarios de retiro en persona. |
| `fair_sessions` | Jornadas de feria: lugar, apertura, cierre y total informado por Point. |
| `orders` | Pedidos online **y** ventas de feria en una sola tabla; `channel` los distingue. |
| `order_items` | Productos de cada pedido, con precio, cantidad y molienda. |
| `stock_movements` | Cada cambio de stock con su motivo: pedido, liberación, compra, ajuste, migración o inicio de jornada. |
| `events` | Hechos importantes del negocio (pedido creado, pago confirmado, venta de feria…). Es la materia prima de los reportes y agentes. |
| `staff` | Personal autorizado y su rol: **admin** u **operador** de feria. |

## Reglas que la base de datos garantiza

- **El stock nunca queda negativo**, aunque se vendan unidades online y en la feria al mismo tiempo.
- **Un pedido reserva todo o nada:** si falta stock de un solo producto (incluido uno dentro de una promoción), no se descuenta nada.
- **Las promociones no tienen stock propio:** descuentan el de cada producto incluido.
- **Las moliendas no tienen stock separado:** se guardan en el pedido y descuentan del mismo café.
- **Los preparados nunca aparecen en la tienda online.** Las bebidas pueden venderse sin control de stock (`track_stock = false`).
- **Los pedidos sin pagar expiran:** después de 30 minutos el stock vuelve a estar disponible.
- **Los totales cuadran:** total = subtotal + envío.
- **Toda venta de feria pertenece a una jornada.**

## Seguridad

- El público solo puede **leer** el catálogo visible y los lugares de retiro.
- Clientes, pedidos, stock y ventas solo se leen y modifican desde el servidor de la aplicación, que verifica que la persona sea admin u operador.
- Los agentes no se conectarán directamente a esta base; usarán una API de solo lectura con permisos mínimos.

## Ejemplos

- **Pedido online de 2 bolsas Caicedo (molienda media) + Promo Cafetera + Tetera:** al presionar "Pagar" se descuentan 2 Caicedo, 1 cafetera y 1 tetera. Si el pago se rechaza o pasan 30 minutos, las 4 unidades vuelven al stock.
- **Venta en feria de 3 americanos y 1 torta:** los americanos no descuentan stock; la torta descuenta de las cargadas al abrir la jornada.
