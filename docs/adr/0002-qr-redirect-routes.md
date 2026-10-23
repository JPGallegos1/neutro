# ADR 0002: QR redirect routes on the `neutro-web` Worker

## Status

Accepted

## Context

Physical flyer and business-card QR codes need short, stable URLs on `neutro.solutions` that land on the marketing site with UTM parameters (scheme approved with SEO). The public site remains an Astro static build served as Cloudflare Workers Static Assets. Redirects must:

- Return **302** (not 301) so campaign destinations stay flexible.
- Send **`X-Robots-Tag: noindex`** and **`Cache-Control: no-store`** so crawlers and caches do not treat scan URLs as indexed content.
- Optionally log a cookieless `qr_scanned` event to PostHog EU without delaying or breaking the redirect (anonymous distinct id, `$process_person_profile: false`, no IP / User-Agent stored).

A `_redirects` file alone cannot attach custom analytics via `waitUntil` or keep mapping logic unit-tested in TypeScript.

## Decision

1. **Domain mapping** lives in `@neutro/core` (`qr-redirects.ts`): a typed table of flyer ids → slugs and a pure `resolveQrRedirect(pathname)` function. Unknown `/f/*` ids redirect to `https://neutro.solutions/` with **no** UTMs. `/t` is the evergreen business-card code.
2. **Worker entry** `apps/web/worker/index.ts` is the `main` for Wrangler worker `neutro-web`. `assets.run_worker_first` is limited to `/f`, `/f/*`, `/t`, `/t/`, `/ingest`, `/ingest/`, and `/ingest/*` so the rest of the site stays asset-first. `/ingest` is the first-party PostHog proxy.
3. **Server analytics** uses env `POSTHOG_KEY` + `ANALYTICS_ENABLED=true` (Worker vars/secrets, not browser `PUBLIC_*` flags). Capture runs in `ctx.waitUntil`. Failures are swallowed. Without both flags, redirects still work and no event is sent.
4. **Trailing slashes** are accepted by normalizing the pathname before lookup.

## Consequences

- Deploying the site requires a Worker script in addition to the Astro `dist` assets (already named `neutro-web`).
- Adding a new flyer code is a table edit + unit test in `@neutro/core`, not a Wrangler config change.
- QR scan logging talks to `eu.i.posthog.com` directly from the Worker when enabled. Browser analytics, when the public flags are on, uses that same EU region through the `/ingest` proxy and does not call PostHog hosts from the page.
