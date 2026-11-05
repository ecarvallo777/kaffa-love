# Flujos principales: Kaffa Love

**Versión:** 0.2 · Complementa el [PRD](PRD.md)

Los puntos marcados con **[Confirmado]** son decisiones ya acordadas.

## 1. Compra online

### Paso a paso del cliente

1. **Descubre:** llega al inicio o a una categoría y abre la ficha de un café, un accesorio o una promoción.
2. **Elige:** en un café selecciona la molienda (en grano, fina, media o gruesa) y la cantidad. **[Confirmado]** No preseleccionar la molienda, para que el cliente siempre la elija conscientemente.
3. **Agrega al carrito:** ve un aviso breve y puede seguir comprando o ir al carrito.
4. **Revisa el carrito:** cambia cantidades o moliendas, elimina productos y ve el subtotal.
5. **Datos de contacto:** correo, nombre y teléfono. **[Confirmado]** Permitir comprar sin crear cuenta (es lo más rápido) y ofrecer crear una contraseña después del pago. Una casilla, desmarcada por defecto, para recibir novedades.
6. **Entrega:**
   - **Retiro en persona:** se muestran el lugar y los horarios, sin costo.
   - **Despacho:** ingresa la dirección, la aplicación cotiza con BlueExpress y muestra las opciones con precio y plazo. Si la cotización falla, ve un mensaje claro y puede reintentar o elegir retiro.
7. **Resumen:** productos, molienda, entrega, costo de envío y total con IVA. Botón "Pagar con Mercado Pago".
8. **Paga en Mercado Pago:** sale de la tienda hacia Checkout Pro y vuelve al terminar.
9. **Confirmación:** ve el estado real del pedido (pagado, pendiente o rechazado). Si fue aprobado, recibe un correo de confirmación; Mercado Pago le envía la boleta.

### Lo que pasa por detrás

- Al presionar "Pagar", se crea el pedido como **pendiente de pago** y se **reserva el stock**. **[Confirmado]** La reserva dura 30 minutos; si el pago no se aprueba en ese tiempo, el stock se libera.
- Una promoción reserva stock de cada producto que incluye.
- Mercado Pago avisa el resultado directamente a la aplicación (no se confía en la página de retorno):
  - **Aprobado:** pedido pagado, el stock se descuenta definitivamente y se registra el evento "pago confirmado".
  - **Rechazado o expirado:** se libera el stock y el cliente puede reintentar.
- Si alguien compró la última unidad mientras el cliente estaba en el checkout, se le avisa antes de pagar.

### Después del pago (administración)

```
Pagado → En preparación → Despachado (con número de seguimiento BlueExpress) → Entregado
Pagado → En preparación → Listo para retiro (se avisa al cliente) → Retirado
```

## 2. Venta en feria

### Antes de la feria

1. El operador inicia sesión en la vista de feria (desde un celular o una tablet).
2. **Abre la jornada:** nombre o lugar de la feria y fecha.
3. **Preparados del día:** **[Confirmado]** Las bebidas (americano, espresso) se venden sin control de stock y los productos contables (tortas) se cargan con una cantidad inicial, por ejemplo 10 tortas.

### Cada venta

1. Toca una categoría (Café, Accesorios, Preparados) y luego el producto. Cada producto muestra su precio y stock.
2. Si es café, elige la molienda con un toque.
3. El carrito muestra la cantidad y el total en grande; se puede quitar o cambiar productos.
4. Presiona **"Cobrar"**: la aplicación muestra el monto a ingresar en Mercado Pago Point.
5. Cobra en el Point y presiona **"Cobro aprobado"**, o **"Cancelar"** si fue rechazado.
6. Al confirmar:
   - se registra la venta como venta de feria;
   - se descuenta el stock compartido (café y accesorios) o el de feria (preparados);
   - se actualiza el total del día.

Si un producto se agotó (por ejemplo, la última bolsa se vendió online), la aplicación avisa antes de confirmar.

### Al cerrar la feria

- **Cerrar jornada:** resumen de ventas totales, cantidad de ventas y productos vendidos.
- El operador compara el total con el resumen de Mercado Pago Point y anota cualquier diferencia.

## 3. Carga de compras con Excel (administración)

1. El administrador descarga una plantilla Excel (producto, cantidad comprada, costo y, si es nuevo, precio de venta, peso y dimensiones).
2. Sube la planilla completada.
3. La aplicación muestra una vista previa: productos nuevos, stock que se suma y filas con errores.
4. El administrador corrige o confirma; el stock se actualiza y queda registrado como "compra".
