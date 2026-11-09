import type { ContactLead, MailMessage } from "./parse.ts";

export const CONTACT_SUBJECT = "Consulta desde /contacto";

export function renderContactEmail(lead: ContactLead): {
  subject: string;
  text: string;
} {
  const lines = [
    "Nueva consulta desde el formulario de /contacto",
    "",
    `Nombre: ${lead.nombre} ${lead.apellido}`,
    `Empresa: ${lead.empresa}`,
    `Email: ${lead.email}`,
    `Ciudad: ${lead.ciudad}`,
    `País: ${lead.pais}`,
    "",
    "Mensaje:",
    lead.mensaje.length > 0 ? lead.mensaje : "(sin mensaje)",
  ];
  return {
    subject: CONTACT_SUBJECT,
    text: lines.join("\n"),
  };
}

export function buildResendPayload(
  lead: ContactLead,
  to: string,
  from: string,
): MailMessage {
  const rendered = renderContactEmail(lead);
  return {
    to,
    from,
    replyTo: lead.email,
    subject: rendered.subject,
    text: rendered.text,
    idempotencyKey: `contacto/${lead.submissionId}`,
  };
}
