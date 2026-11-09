import { contactoCountries } from "../../src/data/contacto.ts";

export type ContactLead = {
  nombre: string;
  apellido: string;
  empresa: string;
  email: string;
  ciudad: string;
  pais: string;
  mensaje: string;
  submissionId: string;
};

export type MailMessage = {
  to: string;
  from: string;
  replyTo: string;
  subject: string;
  text: string;
  idempotencyKey: string;
};

export type MailAccepted = { kind: "accepted"; id: string; status?: number };
export type MailRejected = {
  kind: "rejected";
  reason:
    | "timeout"
    | "rate_limited"
    | "invalid"
    | "concurrent"
    | "idempotency_conflict"
    | "provider_error"
    | "network";
  status?: number;
};

export type MailSender = {
  send(message: MailMessage): Promise<MailAccepted | MailRejected>;
};

export type HumanVerifyInput = {
  token: string;
  remoteIp: string | null;
  idempotencyKey: string;
};

export type HumanVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "unavailable" };

export type HumanVerifier = {
  verify(input: HumanVerifyInput): Promise<HumanVerifyResult>;
};

export type RateLimitResult = { ok: true } | { ok: false };

export type RateLimiter = {
  take(key: string): Promise<RateLimitResult>;
};

export type FieldError = { field: string; code: string };

export type ParseOk = { ok: true; lead: ContactLead; turnstileToken: string };
export type ParseErr = { ok: false; errors: FieldError[] };
export type ParseResult = ParseOk | ParseErr;

export const CONTACT_BODY_LIMIT = 16 * 1024;
export const CONTACT_LINE_MAX = 100;
export const CONTACT_EMAIL_MAX = 254;
export const CONTACT_MESSAGE_MAX = 2000;
export const CONTACT_TOKEN_MAX = 2048;
export const CONTACT_HONEYPOT_FIELD = "website";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_LOCAL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
const EMAIL_DOMAIN_LABEL_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const UNICODE_LINE_BREAK_RE = /[\u0085\u2028\u2029]/;
const MESSAGE_FORBIDDEN_CONTROL_RE =
  /[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f\u0085\u2028\u2029]/;
const COUNTRY_SET = new Set<string>(contactoCountries);

const ALLOWED_KEYS = new Set([
  "nombre",
  "apellido",
  "empresa",
  "email",
  "ciudad",
  "pais",
  "mensaje",
  "consent",
  "turnstileToken",
  "submissionId",
  CONTACT_HONEYPOT_FIELD,
]);

function push(errors: FieldError[], field: string, code: string): void {
  errors.push({ field, code });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function cleanLine(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) return null;
  if (CONTROL_RE.test(trimmed) || UNICODE_LINE_BREAK_RE.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function cleanMessage(value: unknown): string | null {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (normalized.length > CONTACT_MESSAGE_MAX) return null;
  if (MESSAGE_FORBIDDEN_CONTROL_RE.test(normalized)) return null;
  return normalized;
}

function isSingleAddrSpec(value: string): boolean {
  if (value.includes(",") || /[<>"]/.test(value)) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!EMAIL_LOCAL_RE.test(local)) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => EMAIL_DOMAIN_LABEL_RE.test(label));
}

function cleanEmail(value: unknown): string | null {
  const line = cleanLine(value, CONTACT_EMAIL_MAX);
  if (!line) return null;
  if (!isSingleAddrSpec(line)) return null;
  return line.toLowerCase();
}

export function isHoneypotTriggered(body: Record<string, unknown>): boolean {
  const value = body[CONTACT_HONEYPOT_FIELD];
  return typeof value === "string" && value.trim().length > 0;
}

export function parseContactRequest(input: unknown): ParseResult {
  const body = asRecord(input);
  if (!body) {
    return { ok: false, errors: [{ field: "_", code: "invalid_json" }] };
  }

  const errors: FieldError[] = [];
  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) {
      push(errors, key, "unknown_field");
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const nombre = cleanLine(body.nombre, CONTACT_LINE_MAX);
  if (!nombre) push(errors, "nombre", "invalid");
  const apellido = cleanLine(body.apellido, CONTACT_LINE_MAX);
  if (!apellido) push(errors, "apellido", "invalid");
  const empresa = cleanLine(body.empresa, CONTACT_LINE_MAX);
  if (!empresa) push(errors, "empresa", "invalid");
  const email = cleanEmail(body.email);
  if (!email) push(errors, "email", "invalid");
  const ciudad = cleanLine(body.ciudad, CONTACT_LINE_MAX);
  if (!ciudad) push(errors, "ciudad", "invalid");

  const paisRaw = typeof body.pais === "string" ? body.pais.trim() : "";
  if (!paisRaw || !COUNTRY_SET.has(paisRaw) || CONTROL_RE.test(paisRaw)) {
    push(errors, "pais", "invalid");
  }

  const mensaje = cleanMessage(body.mensaje);
  if (mensaje === null) push(errors, "mensaje", "invalid");

  if (body.consent !== true) push(errors, "consent", "required");

  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  if (
    turnstileToken.length < 1 ||
    turnstileToken.length > CONTACT_TOKEN_MAX ||
    CONTROL_RE.test(turnstileToken)
  ) {
    push(errors, "turnstileToken", "invalid");
  }

  const submissionId =
    typeof body.submissionId === "string" ? body.submissionId.trim() : "";
  if (!UUID_RE.test(submissionId)) {
    push(errors, "submissionId", "invalid");
  }

  const honeypot = body[CONTACT_HONEYPOT_FIELD];
  if (
    honeypot !== undefined &&
    honeypot !== null &&
    typeof honeypot !== "string"
  ) {
    push(errors, CONTACT_HONEYPOT_FIELD, "invalid");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const lead: ContactLead = {
    nombre: nombre!,
    apellido: apellido!,
    empresa: empresa!,
    email: email!,
    ciudad: ciudad!,
    pais: paisRaw,
    mensaje: mensaje!,
    submissionId,
  };

  return { ok: true, lead, turnstileToken };
}

export async function readJsonBody(
  request: Request,
  limit = CONTACT_BODY_LIMIT,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: 413 | 400; code: string }
> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const size = Number(contentLength);
    if (Number.isFinite(size) && size > limit) {
      return { ok: false, status: 413, code: "payload_too_large" };
    }
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, code: "empty_body" };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > limit) {
      try {
        await reader.cancel();
      } catch {}
      return { ok: false, status: 413, code: "payload_too_large" };
    }
    chunks.push(value);
  }

  if (total === 0) {
    return { ok: false, status: 400, code: "empty_body" };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(merged);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400, code: "invalid_json" };
  }
}
