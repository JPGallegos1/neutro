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

const PHC_TOKEN = /phc_[A-Za-z0-9]+/g;

function ackStatus(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return undefined;
  }
  const status = value.status;
  return typeof status === "string" ? status : undefined;
}

export function captureAck(
  status: number,
  body: string,
): "accepted" | "rejected" {
  if (status < 200 || status >= 300) {
    return "rejected";
  }
  try {
    if (ackStatus(JSON.parse(body)) === "Ok") {
      return "accepted";
    }
  } catch {
    return "rejected";
  }
  return "rejected";
}

export function redactSecrets(text: string, apiKey: string): string {
  const withoutKey =
    apiKey.length > 0 ? text.split(apiKey).join("[redacted]") : text;
  return withoutKey.replace(PHC_TOKEN, "[redacted]");
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
        body: redactSecrets(body, apiKey).slice(0, 120),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    captureLog("posthog_capture_error", {
      ...logged,
      name: error instanceof Error ? error.name : "unknown",
      message: redactSecrets(message, apiKey).slice(0, 120),
    });
  }
}

export function isServerAnalyticsEnabled(env: {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
}): boolean {
  return env.ANALYTICS_ENABLED === "true" && Boolean(env.POSTHOG_KEY);
}
