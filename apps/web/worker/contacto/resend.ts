import type {
  MailAccepted,
  MailMessage,
  MailRejected,
  MailSender,
} from "./parse.ts";

export const RESEND_API_URL = "https://api.resend.com/emails";
export const RESEND_TIMEOUT_MS = 8_000;

type FetchLike = typeof fetch;

export function createResendMailSender(
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): MailSender {
  return {
    async send(message: MailMessage): Promise<MailAccepted | MailRejected> {
      let response: Response;
      try {
        response = await fetchImpl(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": message.idempotencyKey,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            reply_to: message.replyTo,
            subject: message.subject,
            text: message.text,
          }),
          signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        });
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
          return { kind: "rejected", reason: "timeout" };
        }
        if (error instanceof DOMException && error.name === "TimeoutError") {
          return { kind: "rejected", reason: "timeout" };
        }
        return { kind: "rejected", reason: "network" };
      }

      if (response.status === 409) {
        let code = "";
        try {
          const body = (await response.json()) as {
            name?: string;
            message?: string;
          };
          code = body.name ?? body.message ?? "";
        } catch {}
        if (code.includes("concurrent_idempotent_requests")) {
          return {
            kind: "rejected",
            reason: "concurrent",
            status: 409,
          };
        }
        if (code.includes("invalid_idempotent_request")) {
          return {
            kind: "rejected",
            reason: "idempotency_conflict",
            status: 409,
          };
        }
        return { kind: "rejected", reason: "provider_error", status: 409 };
      }

      if (response.status === 429) {
        return { kind: "rejected", reason: "rate_limited", status: 429 };
      }

      if (response.status >= 500) {
        return {
          kind: "rejected",
          reason: "provider_error",
          status: response.status,
        };
      }

      if (response.status >= 400) {
        return { kind: "rejected", reason: "invalid", status: response.status };
      }

      try {
        const body = (await response.json()) as { id?: unknown };
        if (typeof body.id !== "string" || body.id.length < 1) {
          return { kind: "rejected", reason: "provider_error" };
        }
        return { kind: "accepted", id: body.id };
      } catch {
        return { kind: "rejected", reason: "provider_error" };
      }
    },
  };
}
