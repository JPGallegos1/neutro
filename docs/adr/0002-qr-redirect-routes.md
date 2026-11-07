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
2. **Worker entry** `apps/web/worker/index.ts` is the `main` for Wrangler worker `neutro-web`. `assets.run_worker_first` is `true`, so the Worker sees every request before static assets. `/ingest` is the first-party PostHog proxy. The slashless redirect skips `/`, `/f`, `/t`, and `/ingest`.
3. **Server analytics** uses env `POSTHOG_KEY` + `ANALYTICS_ENABLED=true` (Worker vars/secrets, not browser `PUBLIC_*` flags). Capture runs in `ctx.waitUntil`. Failures are swallowed. Without both flags, redirects still work and no event is sent.
4. **Trailing slashes** are accepted by normalizing the pathname before lookup.

## Consequences

- Deploying the site requires a Worker script in addition to the Astro `dist` assets (already named `neutro-web`).
- Adding a new flyer code is a table edit + unit test in `@neutro/core`, not a Wrangler config change.
- QR scan logging talks to `eu.i.posthog.com` directly from the Worker when enabled. Browser analytics, when the public flags are on, uses that same EU region through the `/ingest` proxy and does not call PostHog hosts from the page.

## Extension: outbound prospect links (`/p/<code>`)

Same Worker, same headers (`X-Robots-Tag: noindex`, `Cache-Control: no-store`), same 302 to `https://neutro.solutions/` with UTMs.

- Allowlist in `@neutro/core` (`prospect-codes.ts`). Codes are exactly 4 chars `[a-z0-9]`. Seeded with test codes `t001`–`t005` only.
- Valid code: log `prospect_link_access` (PostHog when `POSTHOG_KEY` + `ANALYTICS_ENABLED`, else structured `console.log`), then 302 with `utm_source` / `utm_medium` / `utm_campaign` / `utm_content=<code>`. Defaults and per-code overrides live in the codes file. Codes with prefix `t` use campaign `prueba-prospeccion`; real codes use `prospeccion-2026-11-10` unless overridden.
- **Unknown or invalid codes return 404** (empty body) with the same safety headers. They do **not** redirect to home and do **not** follow arbitrary URLs. Chosen over the flyer “untagged home” path so a typo or guessed code does not inflate home hits or look like a successful campaign open.
- HEAD still 302s but is marked `method=HEAD` and `counts_as_access=false`. Preview bots (WhatsApp, facebookexternalhit, Twitterbot, Slackbot, TelegramBot, etc.) still 302 with `ua_class=preview` and `counts_as_access=false`.
- `/p/` is excluded from the sitemap. It is **not** Disallow’d in `robots.txt`.
- No new Cloudflare paid storage (KV/D1/R2). Persistence beyond PostHog / Workers Logs would need a separate proposal.
