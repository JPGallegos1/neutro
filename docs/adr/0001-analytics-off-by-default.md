# ADR 0001: Analytics off by default

## Status

Accepted

## Context

The public site will use PostHog (EU cloud) from the browser, with a first-party `/ingest` reverse proxy on the `neutro-web` Worker so events are not blocked and do not talk to PostHog hosts directly. That proxy is not implemented yet. Turning the SDK on now would load third-party code, hit a missing `/ingest` route, and start capturing before we have settled storage/consent beyond cookieless mode.

## Decision

PostHog is prepared in `apps/web/src/lib/analytics.ts` and stays **off** unless both `PUBLIC_POSTHOG_KEY` is set and `PUBLIC_ANALYTICS_ENABLED` is the string `'true'`. Default, local, and CI builds do not initialize the SDK and do not load `posthog-js`.

When those flags are on, init uses `api_host: '/ingest'`, `ui_host: 'https://eu.posthog.com'`, `cookieless_mode: 'always'`, `person_profiles: 'never'`, with session recording and surveys disabled. The `/ingest` proxy remains a TODO and must land before analytics is enabled in production.

No language toggle, identity storage, or cookie-banner decision is implied by this module.

## Consequences

Production can ship this foundation with zero analytics network calls. Enabling PostHog later is an explicit env change plus the Worker proxy, not a code rewrite.
