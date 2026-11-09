# ADR 0011: Envío del formulario de /contacto con Resend desde el Worker de apps/web

## Status

Propuesto (2026-11-09). Juan aprobó Resend + Turnstile server-side + kill switch `CONTACT_ENABLED` off por defecto + textos de UI + mención de Resend en `/privacidad`.

## Context

`/contacto` (#113) no tenía endpoint. El Worker `neutro-web` ya corre delante de los assets (ADR 0002). Dominio Resend `send.neutro.solutions` verificado; destino `hola@neutro.solutions`. Un solo consumidor → vertical en `apps/web/worker`.

## Decision

1. `POST /api/contacto` con parseo/render puros y puertos `MailSender` / `HumanVerifier` / `RateLimiter` (adaptadores Resend fetch, Turnstile Siteverify, Workers Rate Limiting).
2. `CONTACT_ENABLED !== "true"` → 503 sin éxito falso. Fail closed si faltan secrets/vars.
3. Antiabuso: Origin `https://neutro.solutions`, Turnstile fail closed, rate limit por IP hasheada (5/60 s), honeypot `website`, body ≤ 16 KiB, `Idempotency-Key` `contacto/<uuid>`.
4. Email: `from` `no-reply@send.neutro.solutions`, `to` fijo, `reply_to` del visitante, plaintext, sin autorrespuesta.
5. UI: éxito «Tu consulta fue enviada para su entrega»; error «No pudimos confirmar el envío. Probá de nuevo o escribinos a hola@neutro.solutions».
6. `/privacidad`: mención mínima de Resend. CSP: `challenges.cloudflare.com` en `script-src`/`frame-src` al cablear el widget.

## Consequences

Dependencia de Resend/Turnstile; rate limit aproximado; sin contador global de cuota Free. Encender requiere Turnstile real + `CONTACT_ENABLED=true` (Jack). Este ADR no autoriza deploy ni mutar DNS/secrets.
