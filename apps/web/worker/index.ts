import {
  createQrRedirectResponse,
  resolveQrRedirect,
} from "@neutro/core/qr-redirects";

import {
  captureQrScanned,
  isPosthogIngestPath,
  isServerAnalyticsEnabled,
  proxyPosthogIngest,
} from "./posthog";

export interface Env {
  POSTHOG_KEY?: string;
  ANALYTICS_ENABLED?: string;
  ASSETS: Fetcher;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (isPosthogIngestPath(url.pathname)) {
      return proxyPosthogIngest(request, {
        waitUntil: (promise) => {
          ctx.waitUntil(promise);
        },
      });
    }

    const redirect = resolveQrRedirect(url.pathname);

    if (!redirect) {
      return env.ASSETS.fetch(request);
    }

    if (
      redirect.scanEvent &&
      isServerAnalyticsEnabled(env) &&
      env.POSTHOG_KEY
    ) {
      ctx.waitUntil(captureQrScanned(env.POSTHOG_KEY, redirect.scanEvent));
    }

    return createQrRedirectResponse(redirect);
  },
} satisfies ExportedHandler<Env>;
