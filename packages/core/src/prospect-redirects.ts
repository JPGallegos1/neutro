import {
  PROSPECT_LANDING_ORIGIN,
  isProspectCode,
  resolveProspectUtm,
  type ProspectCode,
} from "./prospect-codes.ts";

export const PROSPECT_REDIRECT_HEADERS = {
  "X-Robots-Tag": "noindex",
  "Cache-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
} as const;

export type ProspectUaClass = "preview" | "other";

export type ProspectAccessEvent = {
  code: ProspectCode;
  source: string;
  medium: string;
  campaign: string;
};

export type ProspectRedirectHit = {
  kind: "redirect";
  location: string;
  status: 302;
  headers: typeof PROSPECT_REDIRECT_HEADERS;
  accessEvent: ProspectAccessEvent;
};

export type ProspectNotFound = {
  kind: "not_found";
  status: 404;
  headers: typeof PROSPECT_REDIRECT_HEADERS;
  accessEvent: null;
};

export type ProspectRouteResult = ProspectRedirectHit | ProspectNotFound;

const CONTROL_OR_BACKSLASH = /[\u0000-\u001F\u007F\\]/;
const CODE_PATTERN = /^[a-z0-9]{4}$/;
const PREVIEW_UA =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|Slackbot|TelegramBot|LinkedInBot|Discordbot|SkypeUriPreview/i;

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function landingUrl(params: URLSearchParams): string {
  return `${PROSPECT_LANDING_ORIGIN}/?${params.toString()}`;
}

export function classifyProspectUserAgent(
  userAgent: string | null | undefined,
): ProspectUaClass {
  if (typeof userAgent !== "string" || userAgent.length === 0) {
    return "other";
  }
  return PREVIEW_UA.test(userAgent) ? "preview" : "other";
}

export function prospectAccessCounts(
  method: string,
  uaClass: ProspectUaClass,
): boolean {
  if (method.toUpperCase() === "HEAD") {
    return false;
  }
  return uaClass !== "preview";
}

export function resolveProspectRedirect(
  pathname: string,
): ProspectRouteResult | null {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return null;
  }

  if (CONTROL_OR_BACKSLASH.test(pathname)) {
    return null;
  }

  const normalized = normalizePathname(pathname);

  if (normalized === "/p") {
    return {
      kind: "not_found",
      status: 404,
      headers: PROSPECT_REDIRECT_HEADERS,
      accessEvent: null,
    };
  }

  if (!normalized.startsWith("/p/")) {
    return null;
  }

  const match = /^\/p\/([a-z0-9]+)$/.exec(normalized);
  if (!match) {
    return {
      kind: "not_found",
      status: 404,
      headers: PROSPECT_REDIRECT_HEADERS,
      accessEvent: null,
    };
  }

  const code = match[1];
  if (code === undefined || !CODE_PATTERN.test(code) || !isProspectCode(code)) {
    return {
      kind: "not_found",
      status: 404,
      headers: PROSPECT_REDIRECT_HEADERS,
      accessEvent: null,
    };
  }

  const utm = resolveProspectUtm(code);
  const params = new URLSearchParams({
    utm_source: utm.source,
    utm_medium: utm.medium,
    utm_campaign: utm.campaign,
    utm_content: code,
  });

  return {
    kind: "redirect",
    location: landingUrl(params),
    status: 302,
    headers: PROSPECT_REDIRECT_HEADERS,
    accessEvent: {
      code,
      source: utm.source,
      medium: utm.medium,
      campaign: utm.campaign,
    },
  };
}

export function createProspectRedirectResponse(
  redirect: ProspectRedirectHit,
): Response {
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

export function createProspectNotFoundResponse(
  result: ProspectNotFound,
): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers)) {
    headers.set(name, value);
  }
  return new Response(null, {
    status: result.status,
    headers,
  });
}
