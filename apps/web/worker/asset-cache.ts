export const ASSET_ERROR_CACHE_CONTROL = "no-store";

export const LONG_CACHE_ASSET_PREFIXES = [
  "/_astro/",
  "/images/",
  "/video/",
] as const;

const CACHEABLE_ASSET_STATUSES = new Set([200, 206, 304]);

export function isLongCacheAssetPath(pathname: string): boolean {
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
