import { siteUrl } from "@/lib/env";
import { fmtDateTime } from "@/lib/format";
import { ActionForm } from "@/components/admin/action-form";
import { Card, Field, btn, field } from "@/components/admin/ui";
import { connectMetaPixelAction, disconnectMetaPixelAction, testMetaPixelAction } from "./actions";
import type { getMetaPixelConfig } from "@/lib/marketing/meta-pixel";

type Config = Awaited<ReturnType<typeof getMetaPixelConfig>>;

export function MetaPixelSection({ config }: { config: Config }) {
  if (!config) {
    return (
      <Card title="Anuncios en Instagram y Facebook (píxel de Meta)">
        <p className="text-sm text-ink-soft">
          Conecta el píxel para que Meta sepa quién vio, agregó al carrito y compró cada café. Sin esto los anuncios con el catálogo no pueden mostrarle a cada
          persona el producto que miró, ni aprender quién compra. Se hace una sola vez:
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>En business.facebook.com → <b>Administrador de eventos</b> → <b>Conectar orígenes de datos</b> → <b>Web</b>. Ponle «Kaffa Love» y elige configurar con la API de conversiones (manual).</li>
          <li>En el conjunto de datos, <b>Configuración</b>: copia el <b>ID del conjunto de datos</b> y, más abajo, en «API de conversiones», presiona <b>Generar token de acceso</b>.</li>
          <li>Pega ambos aquí.</li>
        </ol>
        <ActionForm action={connectMetaPixelAction} className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="ID del conjunto de datos (píxel)" className="w-56">
            <input name="pixelId" inputMode="numeric" autoComplete="off" required className={field} />
          </Field>
          <Field label="Token de la API de conversiones" className="min-w-0 flex-1">
            <input name="token" type="password" autoComplete="off" required className={field} placeholder="EAA…" />
          </Field>
          <Field label="Código de prueba (opcional)" className="w-44">
            <input name="testEventCode" autoComplete="off" className={field} placeholder="TEST…" />
          </Field>
          <button className={btn.primary}>Conectar</button>
        </ActionForm>
      </Card>
    );
  }

  return (
    <Card
      title="Anuncios en Instagram y Facebook (píxel de Meta)"
      actions={
        <ActionForm action={disconnectMetaPixelAction}>
          <button className={btn.secondary}>Quitar</button>
        </ActionForm>
      }
    >
      <p className="text-sm text-ink-soft">
        Conectado al conjunto de datos <b>{config.name ?? config.pixelId}</b> ({config.pixelId}) desde el {fmtDateTime(config.connectedAt)}. La tienda envía vistas de
        producto, carritos, inicios de pago y compras (estas también desde el servidor), solo de quienes aceptan las cookies.
        {" "}Última compra enviada: {config.lastPurchaseAt ? fmtDateTime(config.lastPurchaseAt) : "ninguna aún"}.
      </p>
      {config.lastError && <p className="mt-2 text-sm text-danger-deep">Último error: {config.lastError}</p>}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">Probar la conexión</summary>
        <p className="mt-2 text-sm text-ink-soft">
          En Administrador de eventos → tu conjunto de datos → <b>Probar eventos</b>, copia el código (TEST…) y pégalo aquí. También puedes abrir la tienda desde esa
          pantalla, aceptar las cookies y ver llegar las vistas y el carrito.
        </p>
        <ActionForm action={testMetaPixelAction} className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Código de prueba" className="w-44">
            <input name="testEventCode" defaultValue={config.testEventCode ?? ""} autoComplete="off" required className={field} />
          </Field>
          <button className={btn.secondary}>Enviar evento de prueba</button>
        </ActionForm>
      </details>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">Siguiente paso: el anuncio con el catálogo</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>En <b>Commerce Manager</b> → tu catálogo → <b>Orígenes de eventos</b>, conecta este conjunto de datos. Espera a que «coincidencia de ids» supere el 90 % (un par de días con visitas).</li>
          <li>En <b>Administrador de anuncios</b>, crea una campaña de <b>Ventas</b> y activa <b>Anuncios del catálogo</b> (Advantage+). Elige el catálogo y como evento de conversión <b>Compra</b> en este conjunto de datos.</li>
          <li>Presupuesto de prueba sugerido: $5.000 al día por 30 días, Chile, desde 25 años. Ubicaciones automáticas (Instagram y Facebook).</li>
          <li>Los anuncios llevan a {siteUrl().replace(/^https?:\/\//, "")}: no hace falta tienda de Instagram (no existe en Chile).</li>
        </ol>
      </details>
    </Card>
  );
}
