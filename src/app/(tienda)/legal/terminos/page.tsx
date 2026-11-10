import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/prose";

export const metadata: Metadata = { title: "Términos y condiciones" };

export default async function TermsPage() {
  const s = await getSettings();
  return (
    <Prose eyebrow="Información" title="Términos y condiciones" updated="noviembre de 2026">
      <p>
        Estos términos regulan las compras realizadas en la tienda online de Kaffa Love. Al comprar declaras haberlos leído y aceptado.
      </p>

      <h2>Precios y productos</h2>
      <ul>
        <li>Los precios están en pesos chilenos e incluyen IVA. El costo de despacho se informa antes de pagar.</li>
        <li>Los cafés se venden en bolsas de 250 g. La molienda que elijas se prepara para tu pedido.</li>
        <li>Las fotos e ilustraciones son referenciales. Las notas de cata describen el perfil del café y no corresponden a saborizantes añadidos.</li>
        <li>La disponibilidad depende del stock al momento de pagar. Si un producto se agota mientras compras, te avisaremos antes del pago.</li>
      </ul>

      {s.welcomePct > 0 && (
        <>
          <h2>Descuento de bienvenida de la feria</h2>
          <p>
            Si llegas a la tienda escaneando el código QR de nuestro stand o de nuestras bolsas, tienes {s.welcomePct} % de descuento sobre el precio
            de los productos en tu primera compra online. Se aplica una vez por correo electrónico, solo si ese correo no tiene compras online
            anteriores, no incluye el despacho y no es canjeable por dinero. El descuento se muestra antes de pagar. Vigente mientras se informe en
            este sitio.
          </p>
        </>
      )}

      <h2>Pago</h2>
      <p>
        Los pagos se procesan a través de Mercado Pago. Kaffa Love no recibe ni almacena los datos de tu tarjeta. Un pedido se confirma solo
        cuando Mercado Pago aprueba el pago. Al iniciar el pago reservamos tus productos por 30 minutos; si el pago no se completa en ese plazo,
        la reserva se libera. La boleta electrónica es emitida por Mercado Pago y llega a tu correo.
      </p>

      <h2>Entrega</h2>
      <ul>
        <li><strong>Retiro en persona:</strong> sin costo, en el lugar y horario indicados al comprar. Te avisaremos por correo cuando esté listo.</li>
        <li>
          <strong>Despacho a domicilio:</strong> realizado por Blue Express. El costo y plazo estimado se muestran en el checkout según tu región.
          Los plazos se cuentan en días hábiles desde la confirmación del pago.
        </li>
      </ul>

      <h2>Cambios, devoluciones y garantía</h2>
      <p>
        Revisa nuestra <Link href="/legal/cambios-y-devoluciones">política de cambios y devoluciones</Link>. Tienes {s.returnDays} días para
        retractarte de tu compra en los términos allí descritos.
      </p>

      <h2>Datos personales</h2>
      <p>
        Usamos tus datos solo para gestionar tu compra y, si lo autorizas, para enviarte novedades. Más detalles en nuestra{" "}
        <Link href="/legal/privacidad">política de privacidad</Link>.
      </p>

      <h2>Contacto</h2>
      <p>
        Para cualquier consulta sobre tu pedido escríbenos{s.contactEmail ? <> a <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></> : <> por nuestros <Link href="/contacto">canales de contacto</Link></>}.
      </p>
    </Prose>
  );
}
