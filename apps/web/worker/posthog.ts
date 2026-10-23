import type { QrScanEvent } from "@neutro/core/qr-redirects";

const POSTHOG_REGION = "eu";

export const POSTHOG_EU_API_HOST = `${POSTHOG_REGION}.i.posthog.com`;
export const POSTHOG_EU_ASSET_HOST = `${POSTHOG_REGION}-assets.i.posthog.com`;
export const POSTHOG_EU_CAPTURE = `https://${POSTHOG_EU_API_HOST}/i/v0/e/`;

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

const INGEST_PREFIX = "/ingest";
const PROXY_METHODS = new Set(["GET", "POST", "OPTIONS"]);

export type PosthogAssetCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

export type PosthogProxyOptions = {
  fetchImpl?: typeof fetch;
  cache?: PosthogAssetCache | null;
  waitUntil?: (promise: Promise<unknown>) => void;
};

export type PosthogUpstream = {
  url: string;
  host: string;
  cacheable: boolean;
};

export function isPosthogIngestPath(pathname: string): boolean {
  return pathname === INGEST_PREFIX || pathname.startsWith(`${INGEST_PREFIX}/`);
}

function isAssetPath(pathname: string): boolean {
  return (
    pathname === "/static" ||
    pathname.startsWith("/static/") ||
    pathname === "/array" ||
    pathname.startsWith("/array/")
  );
}

function unsafePath(pathname: string): boolean {
  if (pathname.includes("\\") || pathname.includes("\0")) {
    return true;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  if (decoded.includes("\\") || /[\u0000-\u001f]/.test(decoded)) {
    return true;
  }
  return decoded.split("/").some((part) => part === "." || part === "..");
}

export function resolvePosthogUpstream(
  requestUrl: string,
): PosthogUpstream | null {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return null;
  }
  if (!isPosthogIngestPath(url.pathname)) {
    return null;
  }

  const rest = url.pathname.slice(INGEST_PREFIX.length);
  const path = rest === "" ? "/" : rest;
  if (unsafePath(path)) {
    return null;
  }
  const cacheable = isAssetPath(path);
  const host = cacheable ? POSTHOG_EU_ASSET_HOST : POSTHOG_EU_API_HOST;

  let target: URL;
  try {
    target = new URL(`${path}${url.search}`, `https://${host}`);
  } catch {
    return null;
  }

  if (
    target.protocol !== "https:" ||
    target.hostname !== host ||
    target.port !== "" ||
    target.username !== "" ||
    target.password !== "" ||
    isAssetPath(target.pathname) !== cacheable
  ) {
    return null;
  }

  return { url: target.href, host, cacheable };
}

function connectingIp(request: Request): string | null {
  const raw = request.headers.get("CF-Connecting-IP");
  if (!raw) {
    return null;
  }
  const value = raw.trim();
  if (value.length === 0 || value.length > 64) {
    return null;
  }
  if (!/^[0-9A-Fa-f:.]+$/.test(value)) {
    return null;
  }
  return value;
}

function proxyRequestHeaders(request: Request, host: string): Headers {
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("authorization");
  headers.set("host", host);
  const ip = connectingIp(request);
  if (ip) {
    headers.set("x-forwarded-for", ip);
  } else {
    headers.delete("x-forwarded-for");
  }
  return headers;
}

function proxyResponseHeaders(source: Headers, allowCache: boolean): Headers {
  const headers = new Headers();
  for (const [key, value] of source.entries()) {
    if (key === "set-cookie" || key === "set-cookie2") {
      continue;
    }
    headers.append(key, value);
  }
  headers.delete("set-cookie");
  headers.delete("set-cookie2");
  if (!allowCache) {
    headers.set("cache-control", "no-store");
    headers.set("cdn-cache-control", "no-store");
    headers.set("cloudflare-cdn-cache-control", "no-store");
  }
  return headers;
}

function proxyResponse(response: Response, allowCache: boolean): Response {
  const nullBody =
    response.status === 204 ||
    response.status === 205 ||
    response.status === 304;
  return new Response(nullBody ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: proxyResponseHeaders(response.headers, allowCache),
  });
}

function assetCacheRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

function proxyRoute(upstream: PosthogUpstream): string {
  if (!upstream.cacheable) {
    return "api";
  }
  return new URL(upstream.url).pathname.startsWith("/array")
    ? "array"
    : "static";
}

function methodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, POST, OPTIONS" },
  });
}

function runtimeAssetCache(): PosthogAssetCache | null {
  const runtime = globalThis as {
    caches?: { default?: PosthogAssetCache };
  };
  return runtime.caches?.default ?? null;
}

async function matchAsset(
  cache: PosthogAssetCache,
  request: Request,
): Promise<Response | null> {
  try {
    return (await cache.match(request)) ?? null;
  } catch {
    return null;
  }
}

export async function proxyPosthogIngest(
  request: Request,
  options: PosthogProxyOptions = {},
): Promise<Response> {
  if (!PROXY_METHODS.has(request.method)) {
    return methodNotAllowed();
  }

  const upstream = resolvePosthogUpstream(request.url);
  if (!upstream) {
    return new Response(null, { status: 400 });
  }

  const cache =
    options.cache === undefined ? runtimeAssetCache() : options.cache;
  const cacheKey = assetCacheRequest(upstream.url);
  if (cache && upstream.cacheable && request.method === "GET") {
    const hit = await matchAsset(cache, cacheKey);
    if (hit) {
      return proxyResponse(hit, true);
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  const init: RequestInit = {
    method: request.method,
    headers: proxyRequestHeaders(request, upstream.host),
    body: hasBody ? request.body : null,
    redirect: "manual",
  };
  if (!upstream.cacheable) {
    init.cache = "no-store";
  }

  let response: Response;
  try {
    response = await fetchImpl(upstream.url, init);
  } catch (error) {
    captureLog("posthog_proxy_error", {
      method: request.method,
      route: proxyRoute(upstream),
      name: error instanceof Error ? error.name : "unknown",
    });
    return new Response(null, { status: 502 });
  }

  const allowCache =
    upstream.cacheable && request.method === "GET" && response.ok;
  const sanitized = proxyResponse(response, allowCache);

  if (cache && allowCache) {
    const pending = cache
      .put(cacheKey, sanitized.clone())
      .catch(() => undefined);
    if (options.waitUntil) {
      options.waitUntil(pending);
    } else {
      await pending;
    }
  }

  return sanitized;
}
