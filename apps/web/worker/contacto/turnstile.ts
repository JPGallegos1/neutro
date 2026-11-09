import type { HumanVerifier, HumanVerifyResult } from "./parse.ts";

export const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const TURNSTILE_TIMEOUT_MS = 5_000;

type FetchLike = typeof fetch;

export type TurnstileConfig = {
  secret: string;
  expectedHostname: string;
  expectedAction: string;
};

export function createTurnstileVerifier(
  config: TurnstileConfig,
  fetchImpl: FetchLike = fetch,
): HumanVerifier {
  return {
    async verify(input): Promise<HumanVerifyResult> {
      let response: Response;
      try {
        response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            secret: config.secret,
            response: input.token,
            ...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
            idempotency_key: input.idempotencyKey,
          }),
          signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
        });
      } catch {
        return { ok: false, reason: "unavailable" };
      }

      if (!response.ok) {
        return { ok: false, reason: "unavailable" };
      }

      let body: {
        success?: unknown;
        hostname?: unknown;
        action?: unknown;
      };
      try {
        body = (await response.json()) as typeof body;
      } catch {
        return { ok: false, reason: "unavailable" };
      }

      if (body.success !== true) {
        return { ok: false, reason: "invalid" };
      }
      if (body.hostname !== config.expectedHostname) {
        return { ok: false, reason: "invalid" };
      }
      if (body.action !== config.expectedAction) {
        return { ok: false, reason: "invalid" };
      }
      return { ok: true };
    },
  };
}
