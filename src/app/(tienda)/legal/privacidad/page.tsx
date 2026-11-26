import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/prose";
import { CookieChoiceReset } from "@/components/meta-pixel";
import { BUSINESS } from "@/lib/legal";

export const metadata: Metadata = { title: "Política de privacidad" };

/*
 * Política de privacidad conforme a la Ley 21.719 (vigente desde el 1-12-2026).
 * Si cambia un proveedor, un uso de los datos o un plazo, actualiza esta página y la fecha.
 */
export default async function PrivacyPage() {
  const s = await getSettings();
  const contact = s.contactEmail ? <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a> : <Link href="/contacto">nuestros canales de contacto</Link>;
  return (
    <Prose eyebrow="Información" title="Política de privacidad" updated="26 de noviembre de 2026">
      <p>
        En Kaffa Love cuidamos tus datos personales y los tratamos conforme a la Ley 19.628 sobre protección de la vida privada, modificada por la Ley 21.719. Aquí te
        contamos qué datos usamos, para qué, con quién los compartimos y cómo ejercer tus derechos.
      </p>

      <h2>Quién es responsable de tus datos</h2>
      <p>
        {BUSINESS.legalName}, RUT {BUSINESS.rut}, con domicilio en {BUSINESS.address}. Para cualquier tema sobre tus datos, escríbenos a {contact}.
      </p>

      <h2>Qué datos usamos</h2>
      <ul>
        <li><strong>Contacto:</strong> nombre, correo y teléfono que ingresas al comprar o crear tu cuenta.</li>
        <li><strong>Despacho:</strong> dirección y comuna, solo si eliges despacho a domicilio.</li>
        <li><strong>Compras:</strong> productos, montos, fechas y estado de tus pedidos.</li>
        <li><strong>Cuenta:</strong> si creas una, tu correo y contraseña (guardada cifrada: nadie del equipo puede leerla).</li>
        <li>
          <strong>Navegación:</strong> un identificador al azar de tu navegador y el canal por el que llegaste (por ejemplo, Instagram o Google), para medir de forma
          agregada cómo se usa la tienda. No incluye tu nombre ni tu correo.
        </li>
        <li><strong>Publicidad (solo si aceptas las cookies):</strong> ver «Cookies y publicidad» más abajo.</li>
      </ul>
      <p>No recibimos ni guardamos los datos de tu tarjeta: el pago lo procesa Mercado Pago. No tomamos decisiones sobre ti de forma automatizada.</p>

      <h2>Para qué los usamos y con qué fundamento</h2>
      <ul>
        <li>
          <strong>Para cumplir tu compra</strong> (procesar el pago, preparar y despachar el pedido, avisarte de su estado, gestionar cambios y devoluciones y
          mantener tu cuenta). Fundamento: el contrato de compraventa que celebras con nosotros.
        </li>
        <li>
          <strong>Para cumplir obligaciones legales</strong>, como las tributarias y las de la ley del consumidor. Fundamento: obligación legal.
        </li>
        <li>
          <strong>Para enviarte correos de marketing:</strong> novedades (nuevos cafés, recetas y promociones), el recordatorio de un carrito que dejaste, el aviso
          de cuándo se te puede estar acabando el café y la invitación a dejar una reseña. Fundamento: tu consentimiento. En el pago, la casilla «Quiero recibir
          novedades» viene marcada: si no quieres recibirlos, desmárcala. Puedes retirar tu consentimiento cuando quieras con el enlace de cada correo, en{" "}
          <Link href="/cuenta">tu cuenta</Link> o en <Link href="/novedades/baja">este formulario</Link>.
        </li>
        <li>
          <strong>Para mostrarte anuncios y medirlos en Instagram y Facebook</strong>, solo si aceptas las cookies de publicidad. Fundamento: tu consentimiento.
        </li>
        <li>
          <strong>Para mejorar la tienda y protegerla</strong> (medición agregada, seguridad y prevención de fraudes). Fundamento: nuestro interés legítimo, que no
          prevalece sobre tus derechos: puedes oponerte escribiéndonos.
        </li>
      </ul>

      <h2>Con quién los compartimos</h2>
      <p>Solo con los proveedores que necesitamos para operar, que los tratan por encargo nuestro y para los fines indicados. No vendemos tus datos.</p>
      <ul>
        <li><strong>Mercado Pago</strong> (pagos y boletas).</li>
        <li><strong>Blue Express</strong> (despachos): nombre, teléfono y dirección de entrega.</li>
        <li><strong>Proveedores de tecnología</strong> que alojan el sitio, la base de datos y los respaldos, y que envían nuestros correos.</li>
        <li><strong>Meta</strong> (Facebook e Instagram), solo si aceptas las cookies de publicidad.</li>
      </ul>
      <p>
        Algunos de estos proveedores guardan los datos en servidores fuera de Chile, principalmente en Estados Unidos y Brasil. Trabajamos con proveedores que se
        obligan contractualmente a proteger los datos con medidas de seguridad adecuadas. También podemos entregar datos a autoridades cuando la ley lo exija.
      </p>

      <h2>Cuánto tiempo los guardamos</h2>
      <ul>
        <li>Tus datos de contacto, direcciones y cuenta: mientras seas cliente, hasta que pidas eliminarlos.</li>
        <li>El registro de tus compras: 6 años, porque la ley tributaria nos obliga a conservar el respaldo de las ventas. Si pides eliminar tus datos, conservamos los pedidos sin tu nombre ni tus datos de contacto.</li>
        <li>Tu autorización para correos de marketing: hasta que te des de baja.</li>
        <li>Los datos para medir anuncios (dirección IP y navegador al comprar): 30 días.</li>
      </ul>

      <h2 id="cookies">Cookies y publicidad</h2>
      <p>
        La tienda usa almacenamiento del navegador para tu carrito y para medir, sin identificarte, cómo se usa el sitio. Además, <strong>solo si lo aceptas</strong> en
        el aviso de cookies, usamos el píxel de Meta (Facebook e Instagram): Meta recibe qué productos viste, agregaste al carrito o compraste y, al comprar, tu
        correo, teléfono, nombre y comuna cifrados (no legibles), junto con la dirección IP y el navegador, para mostrarte nuestros anuncios y medir si funcionan.
        Meta trata esos datos según su propia política de privacidad. Puedes retirar tu aceptación cuando quieras: <CookieChoiceReset />.
      </p>

      <h2>Tus derechos</h2>
      <p>Respecto de tus datos personales, puedes pedirnos:</p>
      <ul>
        <li><strong>Acceso:</strong> saber qué datos tuyos tenemos y cómo los usamos.</li>
        <li><strong>Rectificación:</strong> corregirlos si están mal o incompletos.</li>
        <li><strong>Supresión:</strong> eliminarlos, salvo lo que la ley nos obligue a conservar.</li>
        <li><strong>Oposición:</strong> que dejemos de usarlos para un fin, por ejemplo, marketing.</li>
        <li><strong>Portabilidad:</strong> recibir una copia en un formato electrónico estructurado.</li>
        <li><strong>Bloqueo:</strong> suspender temporalmente su uso mientras revisamos una solicitud tuya.</li>
      </ul>
      <p>
        Escríbenos a {contact} desde el correo con el que compraste, indicando qué necesitas. Es gratis. Te responderemos dentro de 30 días corridos (plazo que
        podemos extender una vez por igual período, avisándote). Si fuera necesario, podremos pedirte algún antecedente para verificar tu identidad. Si no quedas
        conforme con nuestra respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales.
      </p>

      <h2>Seguridad</h2>
      <p>
        El sitio funciona con conexión cifrada, las contraseñas se guardan cifradas y solo el equipo autorizado accede a la administración. Si ocurriera una
        vulneración de seguridad que afecte tus datos, la informaremos a la Agencia de Protección de Datos Personales y, cuando corresponda, a ti.
      </p>

      <h2>Menores de edad</h2>
      <p>La tienda está dirigida a mayores de 18 años. No recopilamos a sabiendas datos de menores.</p>

      <h2>Cambios a esta política</h2>
      <p>Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha. Si el cambio es importante, te avisaremos por correo.</p>
    </Prose>
  );
}
