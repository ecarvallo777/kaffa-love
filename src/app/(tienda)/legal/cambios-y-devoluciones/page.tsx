import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/prose";

export const metadata: Metadata = { title: "Cambios y devoluciones" };

export default async function ReturnsPage() {
  const s = await getSettings();
  const contact = s.contactEmail ? <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> : <Link href="/contacto">nuestros canales de contacto</Link>;
  return (
    <Prose eyebrow="Información" title="Cambios y devoluciones" updated="noviembre de 2026">
      <p>Queremos que disfrutes tu compra. Si algo no resultó como esperabas, esto es lo que puedes hacer.</p>

      <h2>Derecho a retracto</h2>
      <p>
        En compras realizadas en nuestra tienda online puedes retractarte dentro de <strong>{s.returnDays} días corridos</strong> desde
        que recibes o retiras tu pedido, conforme a la Ley N° 19.496 de Protección de los Derechos de los Consumidores.
      </p>
      <ul>
        <li><strong>Accesorios</strong> (cafeteras, teteras, filtros, molinillos): se aceptan sin uso, completos y en su empaque original.</li>
        <li>
          <strong>Café</strong>: por tratarse de un alimento, no aceptamos devoluciones de bolsas abiertas o molidas a pedido, salvo que el producto
          tenga un problema de calidad.
        </li>
        <li>Las <strong>promociones</strong> se devuelven completas.</li>
      </ul>
      <p>Te devolvemos el monto pagado por el mismo medio de pago, a través de Mercado Pago, una vez que recibamos y revisemos el producto.</p>

      <h2>Productos con fallas</h2>
      <p>
        Si un producto llega dañado o presenta una falla, escríbenos dentro de los 6 meses siguientes a la recepción (garantía legal). Podrás
        elegir entre el cambio, la reparación o la devolución del dinero. En estos casos los costos de envío son de nuestro cargo.
      </p>

      <h2>Cómo solicitarlo</h2>
      <p>
        Escríbenos a {contact} indicando tu número de pedido y el motivo. Te responderemos con los pasos para devolver o cambiar el producto. Si
        el retracto no se debe a una falla, el costo del envío de vuelta es de cargo del cliente; también puedes entregarlo en nuestro punto de
        retiro.
      </p>
    </Prose>
  );
}
