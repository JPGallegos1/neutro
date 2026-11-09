# ADR 0011: Envío del formulario de /contacto con Resend desde el Worker de apps/web

## Status

Propuesto (2026-11-09). Juan aprobó Resend + Turnstile server-side + kill switch `CONTACT_ENABLED` off por defecto + textos de UI + mención de Resend en `/privacidad`.

## Context

`/contacto` (#113) no tenía endpoint. El Worker `neutro-web` ya corre delante de los assets (ADR 0002). DNS de `send.neutro.solutions` publicado; el estado del dominio en el panel de Resend lo confirma Jack (este ADR no afirma «verificado» por sí solo). Destino `hola@neutro.solutions`. Un solo consumidor → vertical en `apps/web/worker`.

## Decision

1. `POST /api/contacto` con parseo/render puros y puertos `MailSender` / `HumanVerifier` / `RateLimiter` (adaptadores Resend fetch, Turnstile Siteverify, Workers Rate Limiting).
2. `CONTACT_ENABLED !== "true"` → 503 sin éxito falso. Fail closed si faltan secrets/vars o el binding de rate limit no está disponible.
3. Antiabuso: Origin `https://neutro.solutions`, Turnstile fail closed (hostname/action esperados), rate limit por IP hasheada (5/60 s), honeypot `website`, body ≤ 16 KiB, `Idempotency-Key` `contacto/<uuid>` hacia Resend. Siteverify de Turnstile incluye `idempotency_key` por request.
4. Email: `from` `no-reply@send.neutro.solutions`, `to` fijo, `reply_to` del visitante, plaintext, sin autorrespuesta. Una respuesta `accepted` de Resend (HTTP 2xx + `id`) significa que Resend **aceptó** el mensaje para entrega; no es confirmación de **delivered**.
5. UI: éxito «Tu consulta fue enviada para su entrega»; error «No pudimos confirmar el envío. Probá de nuevo o escribinos a hola@neutro.solutions».
6. `/privacidad`: mención mínima de Resend. CSP: `challenges.cloudflare.com` en `script-src`/`frame-src` al cablear el widget.
7. `mensaje` admite multilínea: se normaliza CRLF/CR → LF y se permite `\n`. Se rechazan el resto de controles C0 (incluido tab), DEL, y los saltos Unicode U+0085 / U+2028 / U+2029 (no se normalizan a LF). Los campos de una línea (`cleanLine`) rechazan controles C0, DEL y esos mismos U+0085 / U+2028 / U+2029 cuando quedan tras `trim` (JS ya elimina esos code points en bordes).
8. Email: una sola addr-spec (`local@domain`); se rechazan comas, `<>`, comillas y varias direcciones.
9. Logs de `contacto_submit`: `result`, `status`, `latency_ms`, `resend_status` (HTTP real del provider o `null`) y `resend_id` (o `null`). Sin body del lead, sin tokens Turnstile, sin API keys.

## Consequences

Dependencia de Resend/Turnstile; rate limit aproximado; sin contador global de cuota Free. Encender requiere Turnstile real + confirmación de Jack del dominio en Resend + `CONTACT_ENABLED=true`. Este ADR no autoriza deploy ni mutar DNS/secrets. `PUBLIC_TURNSTILE_SITE_KEY` es obligatorio en `astro build` (`import.meta.env.PROD`); sin la var el build falla (no hay fallback silencioso al sitekey de test). Dev (`astro dev`), unit tests y CI/e2e pueden fijar la sitekey oficial de prueba de Cloudflare; el build de producción real debe usar el sitekey del widget.
