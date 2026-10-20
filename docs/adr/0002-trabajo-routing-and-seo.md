# ADR 0002: Trabajo routing and SEO

## Status

Proposed — docs only. Implementation waits on design v31 approval (Juan). Do not ship routes from this ADR until that approval lands.

## Context

The landing already shows a Trabajo card grid (`apps/web/src/data/work.ts`) with provisional copy and a single placeholder href (`/trabajo/lina`). There is no `/trabajo` index, no case pages, no sitemap policy for cases, and no Astro `trailingSlash` decision yet.

Jake (SEO) defined hard criteria for the Trabajo surface: index + case URLs, slug rules, absolute self-canonicals, JSON-LD shapes, and a “Cargar más” pattern that must not hide links from the initial HTML. Design v31 (pending) will own visual layout; this ADR locks the routing and SEO contract so implementation does not invent conflicting URL or crawl behavior.

Unconfirmed project names and outcome lines (including “Lina”) must not be treated as final SEO titles or descriptions. Until real case data is approved, docs and stubs use clearly marked placeholders only.

## Decision

### Routes

| Surface | Path              | Notes                                                                                                                                                            |
| ------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index   | `/trabajo`        | Same card grid as the landing Trabajo section; intro copy (ES): `Explorá nuestro trabajo seleccionado`. Show **Cargar más** when there are more than four cases. |
| Case    | `/trabajo/<slug>` | One page per published project.                                                                                                                                  |

Astro must use `trailingSlash: 'never'` (or equivalent `false`). Emit and link **without** a trailing slash. Prefer redirecting accidental trailing-slash requests to the slashless URL when the host allows it.

### Slugs

- Lowercase ASCII only; words joined with hyphens.
- Strip accents; map `ñ` → `n`.
- Prefer at most 3–4 words.
- **Immutable once published.** Any later slug change requires an explicit **301** from the old path to the new one.

Slug source of truth is the project data module (or successor), not free text in templates.

### Canonicals

Absolute, self-referencing:

- `https://neutro.solutions/trabajo`
- `https://neutro.solutions/trabajo/<slug>`

No alternate locale URLs in this ADR (site is Spanish-only).

### Document titles and schema

**Index (`/trabajo`)**

- `<title>`: `Casos y proyectos | Neutro Solutions`
- JSON-LD: `CollectionPage` **and** `ItemList` listing case URLs in display order.

**Case (`/trabajo/<slug>`)**

- `<title>`: `<Cliente>: <qué se resolvió> | Neutro Solutions` — both segments from approved case data, never invented in templates.
- JSON-LD: `Article` **or** `CreativeWork`, plus `BreadcrumbList` (`Inicio` → `Trabajo` → case).
- Exactly one `<h1>` on the page.

Meta descriptions and Open Graph fields likewise come from real (or explicitly placeholder) case fields — not hardcoded marketing fluff.

### “Cargar más” and crawlability

When the index has more than four cases:

1. Render **every** case `<a href="/trabajo/<slug">` in the **server HTML**.
2. Hide items 5+ with CSS / client state only.
3. The button only reveals already-present markup; **no fetch**, no pagination API.
4. Every published case URL is included in the sitemap.

Verification gate: `curl` (or equivalent) of `/trabajo` without executing JS must list all case hrefs.

### Placeholders until approved data

Do not promote unconfirmed examples (e.g. Lina) into final titles or descriptions. Use obvious placeholders such as `{Cliente}`, `{qué se resolvió}`, `{Descripción …}` until Jake/content sign-off.

## Consequences

- Landing and `/trabajo` share the same project list and card presentation contract; case links become real routes instead of dead stubs.
- SEO tooling and sitemap generation can assume slashless absolute URLs under `https://neutro.solutions/trabajo…`.
- Changing a published slug is an ops/content event (301), not a silent rename.
- Implementation PRs must satisfy the curl href check before claiming SEO readiness.
- Visual design remains owned by Pencil v31; this ADR does not approve layout, type, or chrome.
