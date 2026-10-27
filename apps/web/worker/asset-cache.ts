export const ASSET_ERROR_CACHE_CONTROL = "no-store";

export const LONG_CACHE_ASSET_PREFIXES = [
  "/_astro/",
  "/images/",
  "/video/",
  "/og/",
] as const;

export const LONG_CACHE_ASSET_EXACT_PATHS = [
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16x16.png",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/site.webmanifest",
] as const;

const CACHEABLE_ASSET_STATUSES = new Set([200, 206, 304]);

const EXACT_PATH_SET = new Set<string>(LONG_CACHE_ASSET_EXACT_PATHS);

export function isLongCacheAssetPath(pathname: string): boolean {
  if (EXACT_PATH_SET.has(pathname)) {
    return true;
  }
  return LONG_CACHE_ASSET_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

export function isCacheableAssetStatus(status: number): boolean {
  return CACHEABLE_ASSET_STATUSES.has(status);
}

function rebuildResponse(response: Response, headers: Headers): Response {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
    webSocket: response.webSocket,
    cf: response.cf,
  });
}

export function withAssetErrorCacheControl(
  response: Response,
  pathname: string,
): Response {
  if (!isLongCacheAssetPath(pathname)) {
    return response;
  }
  if (isCacheableAssetStatus(response.status)) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", ASSET_ERROR_CACHE_CONTROL);
  return rebuildResponse(response, headers);
}
