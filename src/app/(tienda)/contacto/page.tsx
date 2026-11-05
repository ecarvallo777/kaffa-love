import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { getPickupLocations } from "@/lib/pickup";
import { Prose } from "@/components/prose";

export const metadata: Metadata = { title: "Contacto", description: "Escríbenos por tu pedido, por café o por lo que necesites." };

export default async function ContactPage() {
  const [s, pickups] = await Promise.all([getSettings(), getPickupLocations()]);
  const phoneDigits = s.contactPhone.replace(/\D/g, "");
  return (
    <Prose eyebrow="Hablemos" title="Contacto">
      <p>¿Dudas sobre tu pedido, sobre qué café elegir o cómo prepararlo? Escríbenos.</p>
      <ul>
        {s.contactEmail && <li>Correo: <a href={`mailto:${s.contactEmail}`}>{s.contactEmail}</a></li>}
        {phoneDigits && <li>WhatsApp: <a href={`https://wa.me/${phoneDigits}`}>{s.contactPhone}</a></li>}
        {s.instagram && <li>Instagram: <a href={s.instagram} target="_blank" rel="noopener noreferrer">{s.instagram.replace(/^https?:\/\/(www\.)?/, "")}</a></li>}
      </ul>
      {pickups.length > 0 && (
        <>
          <h2>Retiro en persona</h2>
          {pickups.map((p) => (
            <p key={p.id}>
              <strong>{p.name}</strong>
              <br />
              {p.address}
              <br />
              {p.hours}
            </p>
          ))}
        </>
      )}
    </Prose>
  );
}
