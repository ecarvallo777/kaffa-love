import Link from "next/link";
import { KIND_LABEL, type IgPublication, type IgStatus } from "@/lib/marketing/instagram";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ActionForm, ActionMessage } from "@/components/admin/action-form";
import { Card, Field, Pill, Table, btn, field } from "@/components/admin/ui";
import { cancelPublicationAction, connectInstagramAction, disconnectInstagramAction, publishNowAction } from "./actions";

const STATUS: Record<IgStatus, { label: string; tone: "ok" | "wait" | "bad" | "info" | "neutral" }> = {
  programada: { label: "Programada", tone: "info" },
  procesando: { label: "Procesando", tone: "wait" },
  publicada: { label: "Publicada", tone: "ok" },
  error: { label: "Error", tone: "bad" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

type Account = { username: string; connectedAt: string; refreshedAt: string; expiresAt: string | null } | null;

export function InstagramSection({ account, queue, message }: { account: Account; queue: IgPublication[]; message: string | null }) {
  if (!account) {
    return (
      <Card title="Publicar en Instagram desde aquí">
        {message && <ActionMessage state={{ ok: message }} className="mb-4" />}
        <p className="text-sm text-ink-soft">
          Conecta la cuenta para programar publicaciones, reels e historias con varias fotos o videos. Se hace una sola vez (pasos en{" "}
          <code>docs/PRODUCCION.md</code>, 7.6):
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
          <li>En developers.facebook.com, crea una app con el caso de uso «Administrar mensajes y contenido en Instagram».</li>
          <li>En <strong>Configuración de la API con inicio de sesión de Instagram</strong>, agrega la cuenta de la tienda y presiona <strong>Generar token</strong>.</li>
          <li>Pega el token aquí. La tienda lo renueva sola cada semana.</li>
        </ol>
        <ActionForm action={connectInstagramAction} className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Token de acceso" className="min-w-0 flex-1">
            <input name="token" type="password" autoComplete="off" className={field} placeholder="IGAA…" required />
          </Field>
          <button className={btn.primary}>Conectar</button>
        </ActionForm>
      </Card>
    );
  }

  const upcoming = queue.filter((p) => p.status === "programada" || p.status === "procesando" || p.status === "error").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const recent = queue
    .filter((p) => p.status === "publicada")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, 8);

  return (
    <Card
      title="Instagram"
      actions={
        <div className="flex items-center gap-2">
          <Link href="/admin/marketing/instagram/nueva" className={btn.primary}>Nueva publicación</Link>
        </div>
      }
    >
      {message && <ActionMessage state={{ ok: message }} className="mb-4" />}
      <p className="text-sm text-ink-soft">
        Conectado como <strong>@{account.username}</strong>. El acceso se renueva solo
        {account.expiresAt && <> (vence el {fmtDate(account.expiresAt)} si no se renueva)</>}.
      </p>

      {upcoming.length > 0 ? (
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <th>Cuándo</th>
                <th>Qué</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {upcoming.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(p.scheduledAt)}</td>
                  <td>
                    <span className="font-medium">{KIND_LABEL[p.kind]}</span>
                    <span className="text-ink-mute"> · {p.media.length} {p.media.length === 1 ? "archivo" : "archivos"}</span>
                    {p.caption && <span className="block max-w-md truncate text-xs text-ink-mute">{p.caption}</span>}
                    {p.error && <span className="mt-1 block max-w-md text-xs text-accent-deep">{p.error}</span>}
                  </td>
                  <td><Pill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Pill></td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      {p.status !== "procesando" && (
                        <ActionForm action={publishNowAction} confirm={`¿Publicar ahora en @${account.username}?`}>
                          <input type="hidden" name="id" value={p.id} />
                          <button className={btn.secondary}>{p.status === "error" ? "Reintentar" : "Publicar ahora"}</button>
                        </ActionForm>
                      )}
                      <ActionForm action={cancelPublicationAction} confirm="¿Cancelar esta publicación? Se borran las fotos y videos subidos.">
                        <input type="hidden" name="id" value={p.id} />
                        <button className={btn.danger}>Cancelar</button>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-mute">No hay publicaciones programadas.</p>
      )}

      {recent.length > 0 && (
        <>
          <h3 className="mt-6 mb-2 text-sm font-medium">Publicadas</h3>
          <ul className="space-y-1 text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-2">
                <span className="text-ink-mute">{fmtDateTime(p.publishedAt)}</span>
                <span>{KIND_LABEL[p.kind]} · {p.media.length} {p.media.length === 1 ? "archivo" : "archivos"}</span>
                {p.permalinks?.map((l, i) => (
                  <a key={l} href={l} target="_blank" rel="noreferrer" className="text-accent underline-offset-4 hover:underline">
                    Ver{p.permalinks!.length > 1 ? ` ${i + 1}` : ""}
                  </a>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}

      <ActionForm action={disconnectInstagramAction} confirm="¿Desconectar Instagram? Las publicaciones programadas no saldrán hasta que lo conectes de nuevo." className="mt-6">
        <button className="text-xs text-ink-mute underline-offset-4 hover:underline">Desconectar Instagram</button>
      </ActionForm>
    </Card>
  );
}
