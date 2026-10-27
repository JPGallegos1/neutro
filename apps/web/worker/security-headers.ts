export const X_CONTENT_TYPE_OPTIONS = "nosniff";
export const REFERRER_POLICY = "strict-origin-when-cross-origin";
export const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()";
export const X_FRAME_OPTIONS = "DENY";

export const CSP_REPORT_ONLY =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; media-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";

export const HSTS_MAX_AGE_SECONDS = 300;
export const HSTS_VALUE = `max-age=${HSTS_MAX_AGE_SECONDS}`;

const HSTS_HOSTS = new Set(["neutro.solutions", "www.neutro.solutions"]);

export function isHstsHost(hostname: string): boolean {
  return HSTS_HOSTS.has(hostname);
}

function isHtmlContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  return contentType.toLowerCase().startsWith("text/html");
}

export function withSecurityHeaders(
  response: Response,
  hostname: string,
): Response {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", X_CONTENT_TYPE_OPTIONS);
  headers.set("Referrer-Policy", REFERRER_POLICY);
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Frame-Options", X_FRAME_OPTIONS);

  if (isHtmlContentType(headers.get("content-type"))) {
    headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  }

  if (isHstsHost(hostname)) {
    headers.set("Strict-Transport-Security", HSTS_VALUE);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
