# ADR 0001: Analytics apagado por defecto, habilitado en producción por variables de build

## Status

Aceptado, habilitado en producción por variables de build. Apagado por defecto sigue valiendo para desarrollo, previews y `staging`.

## Context

The public site will use PostHog (EU cloud) from the browser, with a first-party `/ingest` reverse proxy on the `neutro-web` Worker so events are not blocked and do not talk to PostHog hosts directly. The proxy is implemented. Turning the SDK on still loads third-party code and starts capturing, which waits until storage and consent are settled beyond cookieless mode.

## Decision

PostHog is prepared in `apps/web/src/lib/analytics.ts` and stays **off** unless both `PUBLIC_POSTHOG_KEY` is set and `PUBLIC_ANALYTICS_ENABLED` is the string `'true'`. Default, local, and CI builds do not initialize the SDK and do not load `posthog-js`.

When those flags are on, init uses `api_host: '/ingest'`, `ui_host: 'https://eu.posthog.com'`, `cookieless_mode: 'always'`, `person_profiles: 'never'`, with session recording and surveys disabled. The Worker proxies `/ingest` to PostHog EU: `/ingest/static/*` and `/ingest/array/*` go to `eu-assets.i.posthog.com`, and every other `/ingest/*` path goes to `eu.i.posthog.com`, the same host as server-side capture. The proxy does not set cookies.

No language toggle, identity storage, or cookie-banner decision is implied by this module.

## Consequences

Production can ship this foundation with zero analytics network calls until the public flags are enabled. Enabling PostHog is an explicit env change; the Worker proxy is already in place.

## Actualización (2026-10-26)

La decisión de arriba no se borra. Sigue siendo el mecanismo: sin las dos variables de build, el SDK no corre. Lo que esta sección fija es el estado en producción y el encuadre que Juan cerró el 23/10/2026.

El 23/10/2026 Juan Gallegos eligió la variante A:

- PostHog Cloud UE (Fráncfort).
- Proxy `/ingest` en nuestro dominio.
- `cookieless_mode: "always"`.
- `person_profiles: "never"`.
- La IP del cliente se descarta ("Discard client IP data").
- Sin banner de cookies: en el pie, un link a `/cookies`.

Desde el deploy del 24/10/2026 el analytics del navegador está activo en producción. Se prende con las variables de build de Astro `PUBLIC_POSTHOG_KEY` y `PUBLIC_ANALYTICS_ENABLED=true`. Este documento no incluye valores de keys.

El Worker manda `qr_scanned` server-side con `POSTHOG_KEY` y `ANALYTICS_ENABLED="true"` en `wrangler.jsonc`. El evento se llama `qr_scanned` (no `flyer_scanned`). Se emite en `apps/web/worker/index.ts` para `/f/N` y `/t`, con propiedades `slug`, `id`, `source` y `campaign`.

Sin las dos variables de build no se descarga `posthog-js` (import dinámico) y el SDK no corre. Apagado por defecto sigue valiendo para desarrollo, previews y `staging`. Las previews y `staging` tienen que quedar con analytics apagado ([ADR 0006](0006-workers-builds-delivery.md), estado Propuesto).
