# ADR 0005: Trabajo routing and SEO

## Status

Accepted — Juan (26/10/2026). Design reference: Iris **v34**. Reviewers: Jake (SEO), Melody / Iris (design). Do not merge follow-up doc edits without Juan’s OK.

## Context

The public site ships five published Trabajo projects. The landing shows a card grid from `apps/web/src/data/work.ts` capped by `LANDING_WORK_LIMIT` (**always 4**). The full index lives at `/trabajo` with progressive-enhancement **Cargar más**; each project has a case page at `/trabajo/<slug>`.

Jake (SEO) defined hard criteria for the Trabajo surface: index + case URLs, slug rules, absolute self-canonicals (including paginated index URLs), JSON-LD shapes, and a “Cargar más” pattern that must not hide links from the initial HTML. Design v34 (Iris) supplies the visual system for case pages and the index; this ADR locks routing, SEO, and the progressive-enhancement contract so implementation does not invent conflicting crawl behavior.

## Decision

### Routes

| Surface | Path              | Notes                                                                                                                                                                                |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Index   | `/trabajo`        | Header title (ES): `TRABAJO`. Intro (ES): `Explorá nuestro trabajo seleccionado.` Same card grid as the landing Trabajo section. **Cargar más** when there are more than four cases. |
| Case    | `/trabajo/<slug>` | One page per published project. Each case page shows **2–3 related cases**.                                                                                                          |

Astro must use exactly `trailingSlash: 'never'`. Emit and link **without** a trailing slash. Prefer redirecting accidental trailing-slash requests to the slashless URL when the host allows it.

Landing vs index: the home Trabajo section always shows the first **`LANDING_WORK_LIMIT` (4)** cards. **Cargar más** exists only on `/trabajo`, never on the landing.

### Slugs

- Lowercase ASCII only; words joined with hyphens.
- Strip accents; map `ñ` → `n`.
- **Maximum 4 words** (hard limit, not a soft preference).
- No stopwords. No dates (no years, months, or numeric date fragments).
- **Immutable once published.** Any later slug change requires an explicit **301** from the old path to the new one.

Slug source of truth is the project data module (or successor), not free text in templates.

**Published slugs (5)**

| Path                               | Notes                                      |
| ---------------------------------- | ------------------------------------------ |
| `/trabajo/conexion-laboral`        | Conexión Laboral                           |
| `/trabajo/afectiva`                | Afectiva Comunicaciones                    |
| `/trabajo/capa-automotores`        | Capa Automotores                           |
| `/trabajo/suplementacion-ciencia`  | Suplementación con Ciencia (no stopword)   |
| `/trabajo/luxurycars`              | Luxury Cars                                |

There is no Lina case in the published set.

### Canonicals

Absolute, self-referencing:

- `https://neutro.solutions/trabajo`
- `https://neutro.solutions/trabajo?page=<N>` for each paginated index view (`?page=N`)
- `https://neutro.solutions/trabajo/<slug>`

No alternate locale URLs in this ADR (site is Spanish-only).

### Document titles and schema

**Index (`/trabajo`)**

- `<title>`: `Casos y proyectos | Neutro Solutions`
- JSON-LD: `CollectionPage` **and** `ItemList` listing case URLs in display order.

**Case (`/trabajo/<slug>`)**

- `<title>`: `<Cliente>: <qué se resolvió> | Neutro Solutions` — both segments from approved case data, never invented in templates.
- Meta description: **140–155 characters**, from real approved data only.
- JSON-LD: `Article` **or** `CreativeWork`, plus `BreadcrumbList` (`Inicio` → `Trabajo` → case).
- Exactly one `<h1>` on the page.
- Show **2–3 related cases** (links to other published cases).

Meta descriptions and Open Graph fields likewise come from real (or explicitly placeholder) case fields — not hardcoded marketing fluff.

### “Cargar más” and crawlability

Index behavior:

1. Show **4** cases initially.
2. Render the **Cargar más** control **only if** there are more than four cases (label ES: `Cargar más`).
3. Each click reveals **4 more** nodes already present in the server HTML. **No fetch** — the button never requests the network.
4. Render **every** case `<a href="/trabajo/<slug>">` in the **server HTML** (including items beyond the first four). Items 5+ may be visually hidden with CSS / client state until revealed.
5. Every published case URL is included in the sitemap.

**Scale fallback (progressive enhancement):** also emit a real server-rendered `<a href="/trabajo?page=2">` (and further `?page=N` as needed). If JS intercepts that link, it **only reveals nodes already in the page** and **never requests the server**. Without JS, the link navigates to a server-rendered page for that page of results. Each `?page=N` response has its own self-referencing canonical (see Canonicals).

Verification gates (`curl` or equivalent, no JS):

- `/trabajo` lists all case hrefs.
- No Trabajo href in the response ends with a trailing slash.

### Design (v34)

Reuse the landing **Card / Work** components and the landing Trabajo grid for cards. Case pages follow Iris **v34**: sticky title column, visible **En producción** tag on cards and case pages, primary CTA for **Visitar sitio**, 16:9 cover, sectioned body + featured quote; **no 1px dividers**. Primary **Cargar más** button: `#2B4BFF`, centered on desktop, left-aligned on mobile. Site nav label `Trabajo` links to `/trabajo`.

## Consequences

- Landing and `/trabajo` share the same project list and Card / Work presentation; case links are real `/trabajo/<slug>` routes.
- SEO tooling and sitemap generation assume slashless absolute URLs under `https://neutro.solutions/trabajo…`, including self-canonical `?page=N` index URLs.
- Changing a published slug is an ops/content event (301), not a silent rename.
- Implementation PRs must satisfy the curl href and no-trailing-slash checks before claiming SEO readiness.
- Design follows v34 (Iris / Juan): **En producción** ships; card/case chrome avoids 1px borders.
