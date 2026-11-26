import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/prose";
import { CookieChoiceReset } from "@/components/meta-pixel";

export const metadata: Metadata = { title: "Política de privacidad" };

export default async function PrivacyPage() {
  const s = await getSettings();
  return (
    <Prose eyebrow="Información" title="Política de privacidad" updated="26 de noviembre de 2026">
      <p>En Kaffa Love cuidamos tus datos personales y los tratamos conforme a la legislación chilena de protección de datos.</p>

      <h2>Qué datos usamos</h2>
      <ul>
        <li>Nombre, correo y teléfono, para confirmar tu pedido y contactarte si hay algún problema.</li>
        <li>Dirección, solo si eliges despacho a domicilio.</li>
        <li>El detalle de tus compras, para gestionar pedidos, cambios y devoluciones.</li>
      </ul>
      <p>No recibimos ni guardamos los datos de tu tarjeta: el pago lo procesa Mercado Pago.</p>

      <h2>Para qué los usamos</h2>
      <ul>
        <li>Procesar, preparar y entregar tus pedidos.</li>
        <li>Emitir comprobantes y cumplir obligaciones legales.</li>
        <li>Enviarte novedades (nuevos cafés, recetas y promociones) <strong>solo si lo autorizaste</strong> al comprar.</li>
        <li>Entender cómo se vende la tienda, de forma agregada, para mejorarla.</li>
      </ul>

      <h2>Con quién los compartimos</h2>
      <p>
        Solo con los servicios necesarios para operar: Mercado Pago (pagos), Blue Express (despachos), nuestros proveedores de alojamiento y
        correo y, si aceptas las cookies de publicidad, Meta (ver abajo). No vendemos tus datos.
      </p>

      <h2 id="cookies">Cookies y publicidad</h2>
      <p>
        La tienda usa almacenamiento del navegador para tu carrito y para medir, sin identificarte, cómo se usa el sitio. Además, <strong>solo si lo aceptas</strong> en
        el aviso de cookies, usamos el píxel de Meta (Facebook e Instagram): Meta recibe qué productos viste, agregaste al carrito o compraste y, al comprar, tu
        correo, teléfono, nombre y comuna cifrados (no legibles), para mostrarte nuestros anuncios y medir si funcionan. Meta trata esos datos según su propia
        política de privacidad. Puedes retirar tu aceptación cuando quieras: <CookieChoiceReset />.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedir acceso, rectificación o eliminación de tus datos, u oponerte a su uso para novedades, escribiéndonos
        {s.contactEmail ? <> a <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></> : <> por nuestros <Link href="/contacto">canales de contacto</Link></>}. Para dejar de
        recibir novedades también puedes usar <Link href="/novedades/baja">este formulario</Link>.
      </p>
    </Prose>
  );
}
