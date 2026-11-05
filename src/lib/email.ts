import "server-only";

/**
 * Envío de correos con Resend (https://resend.com) si RESEND_API_KEY está
 * configurada. Sin clave, los correos se omiten: Mercado Pago igual envía
 * su comprobante y la boleta.
 */
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email] Sin configurar; se omite "${subject}" para ${to}`);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error(`[email] Error ${res.status} al enviar "${subject}":`, await res.text());
    return false;
  }
  return true;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/** Plantilla simple y legible en cualquier cliente de correo */
export function emailLayout(title: string, body: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f6f0e7;font-family:Arial,Helvetica,sans-serif;color:#1d1511">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:560px;background:#fff;border-radius:16px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px">Kaffa <i>Love</i></p>
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:26px">${escapeHtml(title)}</h1>
${body}
</td></tr></table>
<p style="font-size:12px;color:#8b7c70;margin-top:16px">Kaffa Love · Café de especialidad</p>
</td></tr></table></body></html>`;
}
