import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildResendPayload } from "./email.ts";
import {
  CONTACT_EXPECTED_ORIGIN,
  CONTACT_PATH,
  handleContactoRequest,
  type ContactoDeps,
  type ContactoEnv,
} from "./handler.ts";
import {
  CONTACT_BODY_LIMIT,
  parseContactRequest,
  readJsonBody,
} from "./parse.ts";
import type { MailMessage } from "./parse.ts";
import { createResendMailSender } from "./resend.ts";
import { createTurnstileVerifier } from "./turnstile.ts";

const submissionId = "11111111-1111-4111-8111-111111111111";
const validBody = {
  nombre: "Ana",
  apellido: "García",
  empresa: "Neutro",
  email: "Ana@Ejemplo.com",
  ciudad: "Rosario",
  pais: "Argentina",
  mensaje: "Hola",
  consent: true,
  turnstileToken: "token-ok",
  submissionId,
};

function enabledEnv(): ContactoEnv {
  return {
    CONTACT_ENABLED: "true",
    CONTACT_TO: "hola@neutro.solutions",
    CONTACT_FROM: "no-reply@send.neutro.solutions",
    RESEND_API_KEY: "re_test",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  };
}

function deps(overrides: Partial<ContactoDeps> = {}): ContactoDeps {
  return {
    mail: {
      async send() {
        return { kind: "accepted", id: "email_1" };
      },
    },
    verifier: {
      async verify() {
        return { ok: true };
      },
    },
    rateLimiter: {
      async take() {
        return { ok: true };
      },
    },
    to: "hola@neutro.solutions",
    from: "no-reply@send.neutro.solutions",
    createId: () => "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ...overrides,
  };
}

function request(body: unknown, headers?: HeadersInit): Request {
  const h = new Headers({
    "content-type": "application/json",
    Origin: CONTACT_EXPECTED_ORIGIN,
    "Sec-Fetch-Site": "same-origin",
    "CF-Connecting-IP": "203.0.113.10",
  });
  if (headers) new Headers(headers).forEach((v, k) => h.set(k, v));
  return new Request(`https://neutro.solutions${CONTACT_PATH}`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
}

async function status(
  body: unknown,
  env: ContactoEnv,
  override: Partial<ContactoDeps> = {},
  headers?: HeadersInit,
): Promise<number> {
  return (
    await handleContactoRequest(request(body, headers), env, deps(override))
  ).status;
}

describe("contacto API", () => {
  it("parsea lead, payload estable, body grande y adapters stub", async () => {
    const ok = parseContactRequest(validBody);
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.lead.email, "ana@ejemplo.com");
    assert.equal(
      buildResendPayload(ok.lead, "hola@neutro.solutions", "from")
        .idempotencyKey,
      `contacto/${submissionId}`,
    );
    assert.equal(parseContactRequest({ ...validBody, extra: 1 }).ok, false);
    const big = await readJsonBody(
      new Request("https://neutro.solutions/api/contacto", {
        method: "POST",
        body: "x".repeat(CONTACT_BODY_LIMIT + 1),
      }),
    );
    assert.equal(big.ok, false);

    const message: MailMessage = {
      to: "hola@neutro.solutions",
      from: "no-reply@send.neutro.solutions",
      replyTo: "ana@ejemplo.com",
      subject: "s",
      text: "t",
      idempotencyKey: `contacto/${submissionId}`,
    };
    assert.deepEqual(
      await createResendMailSender("re_test", (async () =>
        Response.json({ id: "email_123" })) as typeof fetch).send(message),
      { kind: "accepted", id: "email_123" },
    );
    const conflict = await createResendMailSender(
      "re_test",
      (async () =>
        Response.json(
          { name: "invalid_idempotent_request" },
          { status: 409 },
        )) as typeof fetch,
    ).send(message);
    assert.equal(conflict.kind, "rejected");
    if (conflict.kind === "rejected") {
      assert.equal(conflict.reason, "idempotency_conflict");
    }
    assert.deepEqual(
      await createTurnstileVerifier(
        {
          secret: "s",
          expectedHostname: "neutro.solutions",
          expectedAction: "contacto",
        },
        (async () =>
          Response.json({
            success: true,
            hostname: "neutro.solutions",
            action: "contacto",
          })) as typeof fetch,
      ).verify({ token: "t", remoteIp: null, idempotencyKey: submissionId }),
      { ok: true },
    );
  });

  it("503 disabled, 200 ok, honeypot, 403/429/409 e misma Idempotency-Key", async () => {
    const offEnv = enabledEnv();
    delete offEnv.CONTACT_ENABLED;
    assert.equal(await status(validBody, offEnv), 503);

    let sends = 0;
    const counting = {
      mail: {
        async send(message: MailMessage) {
          sends += 1;
          return { kind: "accepted" as const, id: message.idempotencyKey };
        },
      },
    };
    assert.equal(await status(validBody, enabledEnv(), counting), 200);
    assert.equal(
      await status({ ...validBody, website: "http://spam" }, enabledEnv(), counting),
      200,
    );
    assert.equal(sends, 1);
    assert.equal(
      await status(validBody, enabledEnv(), {}, { Origin: "https://evil.example" }),
      403,
    );
    assert.equal(
      await status(validBody, enabledEnv(), {
        rateLimiter: {
          async take() {
            return { ok: false };
          },
        },
      }),
      429,
    );
    assert.equal(
      await status(validBody, enabledEnv(), {
        mail: {
          async send() {
            return {
              kind: "rejected",
              reason: "idempotency_conflict",
              status: 409,
            };
          },
        },
      }),
      409,
    );

    const keys: string[] = [];
    const shared = {
      mail: {
        async send(message: MailMessage) {
          keys.push(message.idempotencyKey);
          return { kind: "accepted" as const, id: "dup" };
        },
      },
    };
    await status(validBody, enabledEnv(), shared);
    await status(validBody, enabledEnv(), shared);
    assert.deepEqual(keys, [
      `contacto/${submissionId}`,
      `contacto/${submissionId}`,
    ]);
  });

  it("acepta mensaje multilínea LF/CRLF y rechaza otros controles", async () => {
    const delivered: string[] = [];
    const capturing = {
      mail: {
        async send(message: MailMessage) {
          delivered.push(message.text);
          return { kind: "accepted" as const, id: "email_ml" };
        },
      },
    };

    const lf = await handleContactoRequest(
      request({ ...validBody, mensaje: "Hola,\nQuisiera consultar" }),
      enabledEnv(),
      deps(capturing),
    );
    assert.equal(lf.status, 200);
    assert.match(delivered[0] ?? "", /Hola,\nQuisiera consultar/);

    const crlf = await handleContactoRequest(
      request({ ...validBody, mensaje: "Línea uno\r\nLínea dos" }),
      enabledEnv(),
      deps(capturing),
    );
    assert.equal(crlf.status, 200);
    assert.match(delivered[1] ?? "", /Línea uno\nLínea dos/);
    assert.doesNotMatch(delivered[1] ?? "", /\r/);

    let sends = 0;
    const guarded = {
      mail: {
        async send() {
          sends += 1;
          return { kind: "accepted" as const, id: "nope" };
        },
      },
    };
    const bad = await handleContactoRequest(
      request({ ...validBody, mensaje: "Hola\u0000mundo" }),
      enabledEnv(),
      deps(guarded),
    );
    assert.equal(bad.status, 400);
    const body = (await bad.json()) as {
      errors: Array<{ field: string; code: string }>;
    };
    assert.ok(
      body.errors.some(
        (error) => error.field === "mensaje" && error.code === "invalid",
      ),
    );
    assert.equal(sends, 0);

    const tab = await handleContactoRequest(
      request({ ...validBody, mensaje: "Hola\tmundo" }),
      enabledEnv(),
      deps(guarded),
    );
    assert.equal(tab.status, 400);
    assert.equal(sends, 0);
  });
});
