export const QR_LANDING_ORIGIN = "https://neutro.solutions";

export const QR_REDIRECT_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

export const FLYER_QR_SLUGS = {
  "1": "2048",
  "2": "turnos",
  "3": "vacaciones",
  "4": "agenda",
  "5": "sistema",
  "6": "senales",
  "7": "corridas",
  "8": "excel",
} as const;

export type FlyerQrId = keyof typeof FLYER_QR_SLUGS;

export type QrScanEvent = {
  slug: string;
  id: string;
  source: string;
  campaign: string;
};

export type QrRedirectTarget = {
  location: string;
  status: 302;
  headers: typeof QR_REDIRECT_HEADERS;
  scanEvent: QrScanEvent | null;
};

const FLYER_SOURCE = "flyer";
const FLYER_MEDIUM = "qr";
const FLYER_CAMPAIGN = "calle-oct26";

const TARJETA_SOURCE = "tarjeta";
const TARJETA_MEDIUM = "qr";
const TARJETA_CAMPAIGN = "evergreen-marca";
const TARJETA_CONTENT = "tarjeta";

const CONTROL_OR_BACKSLASH = /[\u0000-\u001F\u007F\\]/;

function isFlyerQrId(value: string): value is FlyerQrId {
  return Object.hasOwn(FLYER_QR_SLUGS, value);
}

function landingUrl(params?: URLSearchParams): string {
  if (!params || [...params].length === 0) {
    return `${QR_LANDING_ORIGIN}/`;
  }
  return `${QR_LANDING_ORIGIN}/?${params.toString()}`;
}

function target(
  location: string,
  scanEvent: QrScanEvent | null,
): QrRedirectTarget {
  return {
    location,
    status: 302,
    headers: QR_REDIRECT_HEADERS,
    scanEvent,
  };
}

function untaggedLanding(): QrRedirectTarget {
  return target(landingUrl(), null);
}

export function normalizeQrPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function resolveQrRedirect(pathname: string): QrRedirectTarget | null {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return null;
  }

  if (CONTROL_OR_BACKSLASH.test(pathname)) {
    return null;
  }

  const normalized = normalizeQrPathname(pathname);

  if (normalized === "/t") {
    const params = new URLSearchParams({
      utm_source: TARJETA_SOURCE,
      utm_medium: TARJETA_MEDIUM,
      utm_campaign: TARJETA_CAMPAIGN,
      utm_content: TARJETA_CONTENT,
    });
    return target(landingUrl(params), {
      slug: TARJETA_CONTENT,
      id: "t",
      source: TARJETA_SOURCE,
      campaign: TARJETA_CAMPAIGN,
    });
  }

  if (normalized === "/f") {
    return untaggedLanding();
  }

  const flyerMatch = /^\/f\/([A-Za-z0-9_-]+)$/.exec(normalized);
  if (!flyerMatch) {
    if (normalized.startsWith("/f/")) {
      return untaggedLanding();
    }
    return null;
  }

  const id = flyerMatch[1];
  if (id === undefined || !isFlyerQrId(id)) {
    return untaggedLanding();
  }

  const slug = FLYER_QR_SLUGS[id];
  const params = new URLSearchParams({
    utm_source: FLYER_SOURCE,
    utm_medium: FLYER_MEDIUM,
    utm_campaign: FLYER_CAMPAIGN,
    utm_content: slug,
  });

  return target(landingUrl(params), {
    slug,
    id,
    source: FLYER_SOURCE,
    campaign: FLYER_CAMPAIGN,
  });
}

export function createQrRedirectResponse(redirect: QrRedirectTarget): Response {
  const headers = new Headers({
    Location: redirect.location,
  });
  for (const [name, value] of Object.entries(redirect.headers)) {
    headers.set(name, value);
  }
  return new Response(null, {
    status: redirect.status,
    headers,
  });
}
