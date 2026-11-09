import { buildResendPayload } from "./email.ts";
import {
  isHoneypotTriggered,
  parseContactRequest,
  readJsonBody,
} from "./parse.ts";
import type {
  FieldError,
  HumanVerifier,
  MailSender,
  RateLimiter,
  RateLimitResult,
} from "./parse.ts";
import { createResendMailSender } from "./resend.ts";
import { createTurnstileVerifier } from "./turnstile.ts";

export const CONTACT_PATH = "/api/contacto";
export const CONTACT_EXPECTED_ORIGIN = "https://neutro.solutions";
export const CONTACT_ACTION = "contacto";

export type ContactoEnv = {
  CONTACT_ENABLED?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_EXPECTED_HOSTNAME?: string;
  TURNSTILE_EXPECTED_ACTION?: string;
  CONTACT_RATE_LIMIT?: RateLimit;
};

export type ContactoDeps = {
  mail: MailSender;
  verifier: HumanVerifier;
  rateLimiter: RateLimiter;
  to: string;
  from: string;
  now?: () => number;
  createId?: () => string;
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(status: number, errors: FieldError[]): Response {
  return jsonResponse(status, { ok: false, errors });
}

function isContactEnabled(env: ContactoEnv): boolean {
  return env.CONTACT_ENABLED === "true";
}

function hasRequiredSecrets(env: ContactoEnv): boolean {
  return Boolean(
    env.RESEND_API_KEY &&
      env.TURNSTILE_SECRET_KEY &&
      env.CONTACT_TO &&
      env.CONTACT_FROM,
  );
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (origin !== CONTACT_EXPECTED_ORIGIN) return false;
  const site = request.headers.get("Sec-Fetch-Site");
  if (site && site !== "same-origin") return false;
  return true;
}

function logContact(
  result:
    | "ok"
    | "invalid"
    | "turnstile_fail"
    | "rate_limited"
    | "provider_error"
    | "disabled"
    | "honeypot",
  status: number,
  started: number,
  resendStatus?: number,
  resendId?: string,
): void {
  console.log(
    JSON.stringify({
      event: "contacto_submit",
      result,
      status,
      latency_ms: Math.max(0, Date.now() - started),
      resend_status: resendStatus ?? null,
      resend_id: resendId ?? null,
    }),
  );
}

export async function handleContactoRequest(
  request: Request,
  env: ContactoEnv,
  deps: ContactoDeps,
): Promise<Response> {
  const started = deps.now?.() ?? Date.now();

  if (request.method !== "POST") {
    return errorResponse(405, [{ field: "_", code: "method_not_allowed" }]);
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return errorResponse(415, [{ field: "_", code: "unsupported_media_type" }]);
  }

  if (!originAllowed(request)) {
    return errorResponse(403, [{ field: "_", code: "forbidden_origin" }]);
  }

  if (!isContactEnabled(env) || !hasRequiredSecrets(env)) {
    logContact("disabled", 503, started);
    return errorResponse(503, [{ field: "_", code: "disabled" }]);
  }

  const bodyResult = await readJsonBody(request);
  if (!bodyResult.ok) {
    logContact("invalid", bodyResult.status, started);
    return errorResponse(bodyResult.status, [
      { field: "_", code: bodyResult.code },
    ]);
  }

  if (
    typeof bodyResult.value === "object" &&
    bodyResult.value !== null &&
    !Array.isArray(bodyResult.value) &&
    isHoneypotTriggered(bodyResult.value as Record<string, unknown>)
  ) {
    logContact("honeypot", 200, started);
    return jsonResponse(200, { ok: true });
  }

  const parsed = parseContactRequest(bodyResult.value);
  if (!parsed.ok) {
    logContact("invalid", 400, started);
    return errorResponse(400, parsed.errors);
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const rateKey = await hashRateLimitKey(`contacto:${ip}`);
  const rate = await deps.rateLimiter.take(rateKey);
  if (!rate.ok) {
    logContact("rate_limited", 429, started);
    return errorResponse(429, [{ field: "_", code: "rate_limited" }]);
  }

  const verify = await deps.verifier.verify({
    token: parsed.turnstileToken,
    remoteIp: request.headers.get("CF-Connecting-IP"),
    idempotencyKey: deps.createId?.() ?? crypto.randomUUID(),
  });
  if (!verify.ok) {
    const status = verify.reason === "unavailable" ? 503 : 403;
    logContact(
      verify.reason === "unavailable" ? "provider_error" : "turnstile_fail",
      status,
      started,
    );
    return errorResponse(status, [
      {
        field: "turnstileToken",
        code: verify.reason === "unavailable" ? "unavailable" : "invalid",
      },
    ]);
  }

  const message = buildResendPayload(parsed.lead, deps.to, deps.from);
  const sent = await deps.mail.send(message);
  if (sent.kind === "accepted") {
    logContact("ok", 200, started, sent.status, sent.id);
    return jsonResponse(200, { ok: true });
  }

  if (sent.reason === "idempotency_conflict") {
    logContact("provider_error", 409, started, sent.status);
    return errorResponse(409, [{ field: "_", code: "idempotency_conflict" }]);
  }

  if (
    sent.reason === "timeout" ||
    sent.reason === "rate_limited" ||
    sent.reason === "concurrent" ||
    sent.reason === "network" ||
    sent.reason === "provider_error"
  ) {
    logContact("provider_error", 503, started, sent.status);
    return errorResponse(503, [{ field: "_", code: "provider_unavailable" }]);
  }

  logContact("provider_error", 502, started, sent.status);
  return errorResponse(502, [{ field: "_", code: "provider_error" }]);
}

export function createContactoDeps(env: ContactoEnv): ContactoDeps | null {
  if (
    !env.RESEND_API_KEY ||
    !env.TURNSTILE_SECRET_KEY ||
    !env.CONTACT_TO ||
    !env.CONTACT_FROM
  ) {
    return null;
  }

  return {
    mail: createResendMailSender(env.RESEND_API_KEY),
    verifier: createTurnstileVerifier({
      secret: env.TURNSTILE_SECRET_KEY,
      expectedHostname: env.TURNSTILE_EXPECTED_HOSTNAME ?? "neutro.solutions",
      expectedAction: env.TURNSTILE_EXPECTED_ACTION ?? "contacto",
    }),
    rateLimiter: createWorkersRateLimiter(env.CONTACT_RATE_LIMIT),
    to: env.CONTACT_TO,
    from: env.CONTACT_FROM,
  };
}

export function createWorkersRateLimiter(
  binding: RateLimit | undefined,
): RateLimiter {
  return {
    async take(key: string): Promise<RateLimitResult> {
      if (!binding) {
        return { ok: false };
      }
      try {
        const outcome = await binding.limit({ key });
        return outcome.success ? { ok: true } : { ok: false };
      } catch {
        return { ok: false };
      }
    },
  };
}

export async function hashRateLimitKey(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}
