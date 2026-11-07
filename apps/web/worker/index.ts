import {
  classifyProspectUserAgent,
  createProspectNotFoundResponse,
  createProspectRedirectResponse,
  prospectAccessCounts,
  resolveProspectRedirect,
  type ProspectAccessEvent,
} from "@neutro/core/prospect-redirects";
import {
  createQrRedirectResponse,
  resolveQrRedirect,
} from "@neutro/core/qr-redirects";

import { withAssetErrorCacheControl } from "./asset-cache.ts";
import {
  captureProspectLinkAccess,
  captureQrScanned,
  isPosthogIngestPath,
  isServerAnalyticsEnabled,
  logProspectLinkAccess,
  proxyPosthogIngest,
} from "./posthog.ts";
import { withSecurityHeaders } from "./security-headers.ts";

export interface Env {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
  ASSETS: Fetcher;
}

const RESERVED_ROOTS = ["/f", "/t", "/p", "/ingest"] as const;

export function isWorkersDevHost(hostname: string): boolean {
  return hostname === "workers.dev" || hostname.endsWith(".workers.dev");
}

function isReservedPath(pathname: string): boolean {
  return RESERVED_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export function trailingSlashRedirect(url: URL): Response | null {
  if (url.pathname === "/" || !url.pathname.endsWith("/")) {
    return null;
  }
  if (isReservedPath(url.pathname)) {
    return null;
  }
  const target = new URL(url.href);
  target.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return new Response(null, {
    status: 301,
    headers: {
      Location: target.href,
    },
  });
}

export function withWorkersDevNoindex(
  response: Response,
  hostname: string,
): Response {
  if (!isWorkersDevHost(hostname)) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("X-Robots-Tag", "noindex");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
    webSocket: response.webSocket,
    cf: response.cf,
  });
}

function respond(response: Response, hostname: string): Response {
  return withSecurityHeaders(
    withWorkersDevNoindex(response, hostname),
    hostname,
  );
}

function recordProspectAccess(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  accessEvent: ProspectAccessEvent,
): void {
  const method = request.method;
  const uaClass = classifyProspectUserAgent(request.headers.get("user-agent"));
  const context = {
    method,
    uaClass,
    countsAsAccess: prospectAccessCounts(method, uaClass),
  };

  if (isServerAnalyticsEnabled(env) && env.POSTHOG_KEY) {
    ctx.waitUntil(
      captureProspectLinkAccess(env.POSTHOG_KEY, accessEvent, context),
    );
    return;
  }

  logProspectLinkAccess(accessEvent, context);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (isPosthogIngestPath(url.pathname)) {
      return respond(
        await proxyPosthogIngest(request, {
          waitUntil: (promise) => {
            ctx.waitUntil(promise);
          },
        }),
        url.hostname,
      );
    }

    const prospect = resolveProspectRedirect(url.pathname);
    if (prospect) {
      if (prospect.kind === "redirect") {
        recordProspectAccess(request, env, ctx, prospect.accessEvent);
        return respond(createProspectRedirectResponse(prospect), url.hostname);
      }
      return respond(createProspectNotFoundResponse(prospect), url.hostname);
    }

    const redirect = resolveQrRedirect(url.pathname);

    if (!redirect) {
      const slash = trailingSlashRedirect(url);
      if (slash) {
        return respond(slash, url.hostname);
      }
      return respond(
        withAssetErrorCacheControl(
          await env.ASSETS.fetch(request),
          url.pathname,
        ),
        url.hostname,
      );
    }

    if (
      redirect.scanEvent &&
      isServerAnalyticsEnabled(env) &&
      env.POSTHOG_KEY
    ) {
      ctx.waitUntil(captureQrScanned(env.POSTHOG_KEY, redirect.scanEvent));
    }

    return respond(createQrRedirectResponse(redirect), url.hostname);
  },
} satisfies ExportedHandler<Env>;
