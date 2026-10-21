import type { QrScanEvent } from "@neutro/core/qr-redirects";

export const POSTHOG_EU_CAPTURE = "https://eu.i.posthog.com/i/v0/e/";

const QR_LIB = "neutro-web-worker";

export type QrCaptureIds = {
  eventId: string;
  distinctId: string;
  timestamp: string;
};

export type QrCapturePayload = {
  api_key: string;
  uuid: string;
  event: "qr_scanned";
  distinct_id: string;
  timestamp: string;
  sent_at: string;
  properties: {
    slug: string;
    id: string;
    source: string;
    campaign: string;
    $lib: typeof QR_LIB;
    $process_person_profile: false;
    $geoip_disable: true;
  };
};

export function buildQrCapturePayload(
  apiKey: string,
  event: QrScanEvent,
  ids: QrCaptureIds,
): QrCapturePayload {
  return {
    api_key: apiKey,
    uuid: ids.eventId,
    event: "qr_scanned",
    distinct_id: ids.distinctId,
    timestamp: ids.timestamp,
    sent_at: ids.timestamp,
    properties: {
      slug: event.slug,
      id: event.id,
      source: event.source,
      campaign: event.campaign,
      $lib: QR_LIB,
      $process_person_profile: false,
      $geoip_disable: true,
    },
  };
}

export function captureAck(
  status: number,
  body: string,
): "accepted" | "rejected" {
  if (status < 200 || status >= 300) {
    return "rejected";
  }
  if (!body.includes('"status"') || !body.includes("Ok")) {
    return "rejected";
  }
  return "accepted";
}

function captureLog(
  kind: string,
  details: Record<string, string | number>,
): void {
  console.log(kind, JSON.stringify(details));
}

export async function captureQrScanned(
  apiKey: string,
  event: QrScanEvent,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const ids: QrCaptureIds = {
    eventId: crypto.randomUUID(),
    distinctId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  const payload = buildQrCapturePayload(apiKey, event, ids);
  const logged = {
    slug: event.slug,
    id: event.id,
    event_id: ids.eventId,
    distinct_id: ids.distinctId,
    timestamp: ids.timestamp,
  };

  try {
    const response = await fetchImpl(POSTHOG_EU_CAPTURE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      redirect: "manual",
    });
    const body = (await response.text()).trim();
    const ack = captureAck(response.status, body);
    captureLog(
      ack === "accepted"
        ? "posthog_capture_accepted"
        : "posthog_capture_rejected",
      {
        ...logged,
        status: response.status,
        body: body.slice(0, 120),
      },
    );
  } catch (error) {
    captureLog("posthog_capture_error", {
      ...logged,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function isServerAnalyticsEnabled(env: {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
}): boolean {
  return env.ANALYTICS_ENABLED === "true" && Boolean(env.POSTHOG_KEY);
}
