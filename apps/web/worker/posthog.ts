import type { QrScanEvent } from "@neutro/core/qr-redirects";

const POSTHOG_EU_CAPTURE = "https://eu.i.posthog.com/i/v0/e/";

export async function captureQrScanned(
  apiKey: string,
  event: QrScanEvent,
): Promise<void> {
  const eventUuid = crypto.randomUUID();
  const distinctId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const payload = {
    api_key: apiKey,
    uuid: eventUuid,
    event: "qr_scanned",
    distinct_id: distinctId,
    timestamp,
    properties: {
      slug: event.slug,
      id: event.id,
      source: event.source,
      campaign: event.campaign,
      $lib: "neutro-web-worker",
      $process_person_profile: false,
      $ip: null,
    },
  };

  try {
    console.log(
      "posthog_capture_payload",
      JSON.stringify({
        host: POSTHOG_EU_CAPTURE,
        payload,
      }),
    );

    const response = await fetch(POSTHOG_EU_CAPTURE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.text()).trim();
    console.log(
      response.ok ? "posthog_capture_ok" : "posthog_capture_failed",
      JSON.stringify({
        status: response.status,
        body: body.slice(0, 200),
        uuid: eventUuid,
        distinct_id: distinctId,
        timestamp,
        slug: event.slug,
        id: event.id,
        key_prefix: apiKey.slice(0, 7),
        key_suffix: apiKey.slice(-6),
        key_chars: apiKey.length,
      }),
    );
  } catch (error) {
    console.log(
      "posthog_capture_error",
      JSON.stringify({
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
        uuid: eventUuid,
        distinct_id: distinctId,
        timestamp,
        slug: event.slug,
        id: event.id,
        key_prefix: apiKey.slice(0, 7),
        key_suffix: apiKey.slice(-6),
        key_chars: apiKey.length,
      }),
    );
  }
}

export function isServerAnalyticsEnabled(env: {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
}): boolean {
  return env.ANALYTICS_ENABLED === "true" && Boolean(env.POSTHOG_KEY);
}
