# ADR 0009: Muestras (Templates) app

## Status

Proposed (2026-10-27).

Juan approved the draft on 2026-10-27 and asked for this file alone, as a pull request that stays unmerged. Merge waits for Juan’s explicit OK. Maya confirms that OK. The same gate is what [ADR 0006](0006-workers-builds-delivery.md) calls **Propuesto**. This status is not Accepted.

This document does not create `apps/muestras`, a Worker, or DNS. No app code and no DNS until Juan’s explicit approval.

Architect of this decision: Hamilton. Owner of `apps/muestras`, until a Templates bot exists: Neutro Implementer.

## Context

Neutro needs something visible when a business asks for examples. The published Casos (real work done for a real client) on `/trabajo` are five ([ADR 0005](0005-trabajo-routing-and-seo.md)), and `neutro.solutions` is indexable. A Muestra (a fictional navigable demo of a Neutro service for one Rubro) must never be presented as work done for a client.

Juan (27/10/2026) fixed the commercial frame:

- The main job is a commercial proof: a link to one concrete Muestra, to send on WhatsApp. Organic indexing is secondary and is decided later, one Rubro (business type of a Muestra) at a time. Juan’s reply: follow the recommendation and move forward.
- Each Muestra is a navigable demo with datos de ejemplo (fictional data checked into the repo). A landing is static. A Sistemas demo is a working interface in the browser, with fictional data, with no real backend, and with no client data. Juan’s reply: follow the recommended option.
- Tanda (a batch of Muestras published together) 1 is option A: 7 demos. Web ships 3 landings, and one of those landings includes reservas y turnos (bookings and appointments). Sistemas ships 3. Automatización con IA ships 1. Diseño and Tienda online, from the v1 offer in `apps/web/src/data/services.ts`, wait for a later Tanda. Juan’s reply: follow the recommended options.
- Templates stay off `/trabajo`. `/trabajo` keeps only real client work, including its `ItemList` and JSON-LD. Fictional Muestras live only on the Templates subdomain. Each one is marked with the brand text «Muestra» (the visible label, the word “Muestra”) and stays `noindex` until indexing is decided Rubro by Rubro. `/trabajo` and the home page may link out with a button «¿Querés ver ejemplos?» (“Do you want to see examples?”). Juan’s reply: yes, the recommended option.
- The subdomain is `muestras.neutro.solutions`. Juan chose that host. DNS and the deploy are Jack’s (operations), afterwards, with Juan’s OK.
- The Rubros of Tanda 1 are the set proposed below. Juan’s reply: continue with that structure.
- Until a Templates bot exists, Neutro Implementer owns `apps/muestras` and Hamilton is the architect. Juan creates that bot later. The bot is outside this ADR.
- Iris defines how «Muestra» looks. That look is still open. Maya asks Iris for it.

The first sketch was not the decision. It was a showcase as a new monorepo app, on its own subdomain, for businesses that ask for examples and for people who arrive from organic content, with three landing variants, three Sistemas variants, and three of each Neutro service. Tanda 1 narrows that sketch to the 7 demos above.

Numbering: this ADR is **0009**, the next free number. On `main`, `docs/adr/` runs from [0001](0001-analytics-off-by-default.md) through [0008](0008-orden-manual-unico-de-casos.md). Open pull requests do not add another ADR file. The open amendment of [0005](0005-trabajo-routing-and-seo.md) is left untouched. If a parallel branch takes 0009 before this one integrates, renumber before integrating.

### Characteristics that govern, in this order

1. Content honesty. A Muestra is never confused with a real Caso. The split is a contract, and it is not left to habit.
2. SEO risk stays isolated. A mistake in Muestras cannot affect indexing of `neutro.solutions`.
3. Adding a Muestra stays low-friction. Tanda 1 is 7, and more Tandas will follow.
4. Operating cost stays near zero: no backend, no personal data, no database.
5. One bot owns the app, with a clear boundary against `apps/web`.

## Decision

- **Own bounded context.** A new app, `apps/muestras`, in this monorepo (pnpm + Turborepo), with its own Cloudflare Worker and the host `muestras.neutro.solutions`. The Muestras are that app. They are not a route of `apps/web`. The directory `apps/muestras` does not exist yet.
- **Stack.** The same stack as `apps/web`: Astro with React islands and a static build, so the app can reuse `packages/typescript-config`, `packages/ui`, and the lint and CI rules. Sistemas demos are React islands that run only in the browser. `apps/web` already uses that stack and the Worker `neutro-web`. The muestras Worker does not exist yet.
- **Data.** Every datum is fictional and versioned in the repo, in a typed Muestra registry with the same role as `apps/web/src/data/work-cases.ts`. Sistemas demos keep state only in memory or `localStorage`. The app makes no network call to a Neutro service or to a third party, submits no form, and sets no cookie. Analytics stays off by default ([ADR 0001](0001-analytics-off-by-default.md), _Analytics apagado por defecto, habilitado en producción por variables de build_).
- **Indexing.** Every page sends `noindex` in a meta element and in the `X-Robots-Tag` response header. The app has no sitemap. `robots.txt` does not block these pages: a blocked crawl never reaches the `noindex`. When Juan decides to index one Rubro, that change is an explicit data change on that Muestra, recorded in an ADR or an amendment.
- **Brand text «Muestra».** Every page shows a visible, stable «Muestra» and carries `data-muestra` in the HTML so a test can find it. Iris defines the look. The look is still open.
- **Beside `/trabajo`.** `/trabajo` and the home page link to the subdomain with the button «¿Querés ver ejemplos?». A Muestra never enters the `ItemList`, the JSON-LD, or the Caso cards of `apps/web`.
- **Dependencies.** One app does not import another app. Shared code lives in `packages/*` and is extracted only when a second real consumer exists. If `apps/muestras` needs brand tokens that today live in `apps/web`, those tokens move to `packages/ui` in an earlier, separate pull request. See Open.
- **Delivery.** The app gets its own Worker, with Workers Builds and a preview per pull request, in the shape of [ADR 0006](0006-workers-builds-delivery.md). The title of that ADR is “Flujo de delivery de `neutro-web` con Workers Builds y Worker Previews”, and its status is Propuesto. It covers `neutro-web`. It does not configure this Worker, and it does not create `staging`. DNS for `muestras.neutro.solutions` and the deploy are Jack’s, with Juan’s OK. The Worker and the DNS record do not exist yet.
- **Owner.** Neutro Implementer owns `apps/muestras` until a Templates bot exists. Hamilton is the architect.

### Tanda 1

Seven Muestras, approved by Juan on 2026-10-27. Diseño and Tienda online wait for a later Tanda. The Spanish names are the labels of the demos.

| Offer                 | Form                     | Rubro                                                                   | Muestra                                                                                 |
| --------------------- | ------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Web                   | Landing                  | Servicios profesionales (professional services, a studio or a practice) | Landing                                                                                 |
| Web                   | Landing                  | Gastronomía (food service)                                              | Landing                                                                                 |
| Web                   | Landing                  | Peluquería/estética (hair salon / aesthetics)                           | Landing with reservas y turnos (bookings and appointments)                              |
| Sistemas              | Browser UI, no backend   | Gastronomía (food service)                                              | Gestión de pedidos (order management)                                                   |
| Sistemas              | Browser UI, no backend   | Peluquería/estética (hair salon / aesthetics)                           | Ficha de clientes (client record; a salon record, not a Caso page)                      |
| Sistemas              | Browser UI, no backend   | Servicios profesionales (professional services)                         | Caja y cobranzas (cash and collections)                                                 |
| Automatización con IA | Browser demo, no backend | Peluquería/estética (hair salon / aesthetics)                           | Asistente por WhatsApp que agenda turnos (a WhatsApp assistant that books appointments) |

## Alternatives considered

### A. A section inside `apps/web` (for example `/muestras`)

Indexable pages and pages that must stay out of the index would share one site, so the SEO risk would sit on `neutro.solutions`. Juan already chose a separate subdomain.

### B. A separate repository

A second repo would drop the shared packages, the CI rules, and the common ADRs, and the maintenance would be duplicated.

### C. A real backend or a database for the demos

A backend adds cost, personal data, and attack surface, and it adds no commercial gain. The decision for each Muestra is a browser demo with datos de ejemplo.

## Consequences

Accepted trade-offs:

- One more Worker and one more pipeline, in exchange for isolating SEO risk and content risk.
- Sistemas demos are poorer than a real product. They do not persist across devices. That limit is intentional.
- The subdomain shares the registrable domain with the main site. Muestras set no cookie, so the app has nothing to share with `neutro.solutions`.

This pull request changes one file. It does not add the app, the Worker, the DNS record, a glossary entry, or a Tanda 1 spec.

### Fitness functions

These checks are not implemented in this change. When the app exists, they have to fail on their own:

1. A contract on the muestras `dist`: every page has `noindex` in a meta element, the visible «Muestra» element, and `data-muestra`.
2. Response headers include `X-Robots-Tag: noindex`. The check reads the Worker configuration and, after deploy, a real measurement.
3. No Muestra page appears in the sitemap or in the JSON-LD of `apps/web`. `apps/web` imports nothing from `apps/muestras`, and `apps/muestras` imports nothing from `apps/web`. A lint rule or a dependency test enforces that.
4. No Muestra calls `fetch` or loads a third-party script. A test on `dist`, and an end-to-end test with the network blocked, enforce that.
5. Every Muestra in the registry has a Rubro, a service, a title, a description, and valid datos de ejemplo (a typed schema). The test fails if any of those is missing.

### Ubiquitous language

Terms for the repo glossary ([`GLOSSARY.md`](../../GLOSSARY.md)). This ADR does not edit that file. A later docs pull request adds the entries.

- **Muestra:** a fictional navigable demo of a Neutro service for one Rubro. It is not a Caso.
- **Caso:** real work done for a real client. It lives on `/trabajo`.
- **Rubro:** the business type of the Muestra (for example peluquería).
- **Tanda:** a batch of Muestras published together. Tanda 1 is 7.
- **Datos de ejemplo:** fictional data included in the repo.

### Plan

Each step is verified before the next one. No durations.

1. Juan’s OK on this ADR. The number is 0009. This pull request is that document and stays unmerged until Maya confirms Juan’s OK. No app code and no DNS until that explicit approval.
2. A later docs pull request: glossary entries, and a Tanda 1 spec for the Rubros Juan already approved. Those files are not part of this pull request.
3. A skeleton pull request for `apps/muestras`: Astro, the Worker, `noindex`, the «Muestra» brand, an empty typed registry, contract tests, and fitness functions 1, 3, and 5. No deploy in that pull request.
4. Jack, with Juan’s OK: the Worker, previews, DNS for `muestras.neutro.solutions`, and the post-deploy check of the headers.
5. The 7 Muestras, one pull request each, within the 10-file cap ([ADR 0004](0004-max-pr-files.md)). Order: the 3 landings, then the 3 Sistemas demos, then the Automatización con IA assistant. Lucy reviews each one.
6. The button «¿Querés ver ejemplos?» on `/trabajo` and on the home page. That is an `apps/web` pull request, with Juan’s OK, because it touches the indexable site.

## Open

- The look of the brand text «Muestra». Iris defines it. Pending. Maya asks Iris.
- Whether the brand tokens `apps/muestras` needs already live in `packages/ui`, or still have to be extracted from `apps/web`. To verify before step 3 of the plan. `packages/ui/src/styles/globals.css` exists and defines Neutro color tokens (`--neutro-*`). That file does not close the question, and it is not the «Muestra» brand.

Resolved on 2026-10-27, and recorded above so they are not still open:

- The Rubros of the 7 Muestras are the Tanda 1 table.
- Neutro Implementer owns `apps/muestras`, with Hamilton as architect, until a Templates bot exists.
