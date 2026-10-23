import {
  createQrRedirectResponse,
  resolveQrRedirect,
} from "@neutro/core/qr-redirects";

import { captureQrScanned, isServerAnalyticsEnabled } from "./posthog";

export interface Env {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
  ASSETS: Fetcher;
}

const RESERVED_ROOTS = ["/f", "/t", "/ingest"] as const;

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
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const redirect = resolveQrRedirect(url.pathname);

    if (!redirect) {
      const slash = trailingSlashRedirect(url);
      if (slash) {
        return withWorkersDevNoindex(slash, url.hostname);
      }
      return withWorkersDevNoindex(
        await env.ASSETS.fetch(request),
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

    return withWorkersDevNoindex(
      createQrRedirectResponse(redirect),
      url.hostname,
    );
  },
} satisfies ExportedHandler<Env>;
