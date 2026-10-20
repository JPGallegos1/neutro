import type { QrScanEvent } from "@neutro/core/qr-redirects";

const POSTHOG_EU_CAPTURE = "https://eu.i.posthog.com/i/v0/e/";

export async function captureQrScanned(
  apiKey: string,
  event: QrScanEvent,
): Promise<void> {
  try {
    await fetch(POSTHOG_EU_CAPTURE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        event: "qr_scanned",
        distinct_id: crypto.randomUUID(),
        properties: {
          slug: event.slug,
          id: event.id,
          source: event.source,
          campaign: event.campaign,
          $process_person_profile: false,
          $ip: null,
        },
      }),
    });
  } catch {
    void 0;
  }
}

export function isServerAnalyticsEnabled(env: {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
}): boolean {
  return env.ANALYTICS_ENABLED === "true" && Boolean(env.POSTHOG_KEY);
}
