import type { QrScanEvent } from "@neutro/core/qr-redirects";

const POSTHOG_EU_CAPTURE = "https://eu.i.posthog.com/i/v0/e/";

export async function captureQrScanned(
  apiKey: string,
  event: QrScanEvent,
): Promise<void> {
  try {
    const uuid = crypto.randomUUID();
    const response = await fetch(POSTHOG_EU_CAPTURE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        uuid,
        event: "qr_scanned",
        distinct_id: uuid,
        properties: {
          slug: event.slug,
          id: event.id,
          source: event.source,
          campaign: event.campaign,
          $lib: "neutro-web-worker",
          $process_person_profile: false,
          $ip: null,
        },
      }),
    });
    const body = (await response.text()).trim();
    if (!response.ok) {
      console.log(
        "posthog_capture_failed",
        JSON.stringify({
          status: response.status,
          body: body.slice(0, 200),
          slug: event.slug,
          id: event.id,
        }),
      );
      return;
    }
    console.log(
      "posthog_capture_ok",
      JSON.stringify({
        status: response.status,
        body: body.slice(0, 80),
        slug: event.slug,
        id: event.id,
      }),
    );
  } catch (error) {
    console.log(
      "posthog_capture_error",
      JSON.stringify({
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
        slug: event.slug,
        id: event.id,
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
