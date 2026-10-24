# ADR 0001: Analytics off by default

## Status

Accepted

## Context

The public site will use PostHog (EU cloud) from the browser, with a first-party `/ingest` reverse proxy on the `neutro-web` Worker so events are not blocked and do not talk to PostHog hosts directly. The proxy is implemented. Turning the SDK on still loads third-party code and starts capturing, which waits until storage and consent are settled beyond cookieless mode.

## Decision

PostHog is prepared in `apps/web/src/lib/analytics.ts` and stays **off** unless both `PUBLIC_POSTHOG_KEY` is set and `PUBLIC_ANALYTICS_ENABLED` is the string `'true'`. Default, local, and CI builds do not initialize the SDK and do not load `posthog-js`.

When those flags are on, init uses `api_host: '/ingest'`, `ui_host: 'https://eu.posthog.com'`, `cookieless_mode: 'always'`, `person_profiles: 'never'`, with session recording and surveys disabled. The Worker proxies `/ingest` to PostHog EU: `/ingest/static/*` and `/ingest/array/*` go to `eu-assets.i.posthog.com`, and every other `/ingest/*` path goes to `eu.i.posthog.com`, the same host as server-side capture. The proxy does not set cookies.

No language toggle, identity storage, or cookie-banner decision is implied by this module.

## Consequences

Production can ship this foundation with zero analytics network calls until the public flags are enabled. Enabling PostHog is an explicit env change; the Worker proxy is already in place.
