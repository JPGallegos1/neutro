# ADR 0005: Trabajo routing and SEO

## Status

Accepted — Juan (26/10/2026). Design reference: Iris **v34**. Reviewers: Jake (SEO), Melody / Iris (design). Do not merge follow-up doc edits without Juan’s OK.

Amendment SEO-15 (2026-10-27) — Juan’s OK, cited by Maya. Scope: JSON-LD for case pages and `/trabajo`, the case `<title>`s, **Más trabajo** (every other published case, 2 columns), the single manual order, and the rule of 4 plus **Cargar más**.

Amendment SEO-15 (2026-10-27) — Juan’s OK, cited by Maya. The case `<h1>` is the short design title (`h1Lines`, Iris v34). When that text is not the official `name`, the official name is visible in the initial HTML, in a `<p>` immediately after the `</h1>` (`afectiva`, `capa-automotores`, `suplementacion-ciencia`).

Pagination follow-up (opción A): Juan (26/10/2026) — `/trabajo` is the only indexable index URL; no `?page=N`; all cases ship in the HTML and **Cargar más** only reveals with JS.

## Context

The public site ships five published Trabajo projects. The landing shows a card grid from `apps/web/src/data/work.ts` capped by `LANDING_WORK_LIMIT` (**always 4**). The full index lives at `/trabajo` with progressive-enhancement **Cargar más**; each project has a case page at `/trabajo/<slug>`.

Jake (SEO) defined hard criteria for the Trabajo surface: index + case URLs, slug rules, absolute self-canonicals, JSON-LD shapes, and a “Cargar más” pattern that must not hide links from the initial HTML. Design v34 (Iris) supplies the visual system for case pages and the index; this ADR locks routing, SEO, and the progressive-enhancement contract so implementation does not invent conflicting crawl behavior.

## Decision

### Routes

| Surface | Path              | Notes                                                                                                                                                                                |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Index   | `/trabajo`        | Header title (ES): `Casos de clientes`. Intro (ES): `Explorá nuestro trabajo seleccionado.` Same card grid as the landing Trabajo section. **Cargar más** when there are more than four cases. |
| Case    | `/trabajo/<slug>` | One page per published project. **Más trabajo** lists every other published case, in the manual order, in 2 columns.                                                                  |

Astro must use exactly `trailingSlash: 'never'`. Emit and link **without** a trailing slash. Prefer redirecting accidental trailing-slash requests to the slashless URL when the host allows it.

Landing vs index: the home Trabajo section always shows the first **`LANDING_WORK_LIMIT` (4)** cards. It has no `Ver todos` link and no `Ver todos` button to `/trabajo`. **Cargar más** exists only on `/trabajo`, never on the landing.

There are **no** paginated index routes and **no** `?page=N` URLs for Trabajo.

### Slugs

- Lowercase ASCII only; words joined with hyphens.
- Strip accents; map `ñ` → `n`.
- **Maximum 4 words** (hard limit, not a soft preference).
- No stopwords. No dates (no years, months, or numeric date fragments).
- **Immutable once published.** Any later slug change requires an explicit **301** from the old path to the new one.

Slug source of truth is the project data module (or successor), not free text in templates.

**Published slugs (5)**

| Path                              | Notes                                    |
| --------------------------------- | ---------------------------------------- |
| `/trabajo/conexion-laboral`       | Conexión Laboral                         |
| `/trabajo/afectiva`               | Afectiva Comunicaciones                  |
| `/trabajo/capa-automotores`       | Capa Automotores                         |
| `/trabajo/suplementacion-ciencia` | Suplementación con Ciencia (no stopword) |
| `/trabajo/luxurycars`             | Luxury Cars                              |

There is no Lina case in the published set.

**Manual order.** One order, in one data place (`apps/web/src/data/work.ts`), top to bottom: Conexión Laboral, Afectiva Comunicaciones, Capa Automotores, Suplementación con Ciencia, Luxury Cars. A new case is appended at the end. Luxury Cars stays outside the initial 4. The landing, `/trabajo`, the `ItemList`, and **Más trabajo** (current case removed) use this order.

### Canonicals

Absolute, self-referencing:

- `https://neutro.solutions/trabajo` — **the only** index canonical (no query string)
- `https://neutro.solutions/trabajo/<slug>`

No alternate locale URLs in this ADR (site is Spanish-only).

### Document titles and schema

**Index (`/trabajo`)**

- `<title>`: `Casos de clientes: webs y sistemas | Neutro Solutions`
- JSON-LD: `CollectionPage` **and** `ItemList` listing case URLs in display order (no paginated item URLs).

**Case (`/trabajo/<slug>`)**

- `<title>`: the per-case SEO title Jake fixed, with the suffix ` | Neutro Solutions`, at most **60 characters**. The same string is `og:title` and `twitter:title`. It is not built from `outcomeTitle`. The strings are listed in the SEO-15 amendment.
- Meta description: **140–155 characters**, from real approved data only.
- JSON-LD: `Article` **or** `CreativeWork`, plus `BreadcrumbList` (`Inicio` → `Trabajo` → case).
- Exactly one `<h1>` on the page.
- **Más trabajo**: every other published case, in the manual order, with the current case removed, in 2 columns.

Meta descriptions and Open Graph fields likewise come from real (or explicitly placeholder) case fields — not hardcoded marketing fluff.

### “Cargar más” and crawlability

Index behavior:

1. With JS: show **4** cases initially.
2. Render the **Cargar más** control **only if** there are more than four cases (label ES: `Cargar más`), and only after JS enhances the page (without JS the button does not appear and all cases remain visible).
3. Each click reveals the next batch already present in the server HTML: **4** cases, or fewer when fewer remain. **No fetch** — the button never requests the network. The accessible notice says `caso` for one revealed case and `casos` for more than one.
4. Render **every** case `<a href="/trabajo/<slug>">` in the **server HTML** (including items beyond the first four). Items 5+ may be visually hidden **only after** JS applies client state (for example a class). Do **not** omit those links from the served HTML and do **not** rely on paginated URLs.
5. Every published case URL is included in the sitemap. The sitemap lists `/trabajo` once (no paginated index URLs).

In a listing of 5 cases, the grid is 2 columns and the fifth card sits alone on a third row.

**Scale trigger:** when the published list reaches **12** cases, reopen the decision on `/trabajo` pagination and also evaluate a CMS, according to the tactical order of the code and call performance. Until then, do not introduce `?page=N` or other paginated index URLs.

Verification gates (`curl` or equivalent, no JS):

- `/trabajo` lists all case hrefs.
- No Trabajo href in the response ends with a trailing slash.
- No `?page=` Trabajo links appear in the response.

### Design (v34)

Reuse the landing **Card / Work** components and the landing Trabajo grid for cards. Case pages follow Iris **v34**: sticky title column, visible **En producción** tag on cards and case pages, primary CTA for **Visitar sitio**, 16:9 cover, sectioned body + featured quote; **no 1px dividers**, with one exception already noted in `AGENTS.md`: the `border-top` on `.work-index__more` above **Cargar más** on `/trabajo`. Primary **Cargar más** button: `#2B4BFF`, centered on desktop, left-aligned on mobile. Site nav label `Trabajo` links to `/trabajo`.

### Enmienda SEO-15 (2026-10-27)

In force. Juan’s OK, cited by Maya, on 2026-10-27. This amendment does not change the status above (Accepted). Opción A and the single index canonical `https://neutro.solutions/trabajo` stay. Scope: JSON-LD for case pages and `/trabajo`, the case `<title>`s, **Más trabajo** (every other published case, 2 columns), the single manual order, and the rule of 4 plus **Cargar más**.

Follow-up (2026-10-27) — Juan’s OK, cited by Maya. It amends the case `<h1>` rule and the names table in this section. It does not change the status above (Accepted).

**Index (`/trabajo`)**

- Add a `BreadcrumbList` with exactly two items: `Inicio` → `https://neutro.solutions/`, `Trabajo` → `https://neutro.solutions/trabajo`. `CollectionPage` and `ItemList` stay as specified above.

**Case `CreativeWork` (`/trabajo/<slug>`)**

On the case `CreativeWork` inside the page `@graph` (the layout still emits `https://neutro.solutions/#organization` and `https://neutro.solutions/#website`):

- `creator` is `{ "@id": "https://neutro.solutions/#organization" }`. `publisher` keeps pointing at that same Organization.
- `about` stays the client `Organization` and adds `url`: the client site, the same `href` as **Visitar sitio**. The `url` is an absolute `https` URL.
- `headline` is the case SEO title without the suffix ` | Neutro Solutions`. It is not `outcomeTitle`. It does not contain `Neutro Solutions` and it is not longer than `<title>`.
- `name` is the client’s official name. That same string is the matching card name on `/trabajo`, the `name` of that case in the `/trabajo` `ItemList`, position 3 of the case `BreadcrumbList`, and the value of the visible **Cliente** fact. The case `<h1>` is a short design title (Iris v34) and may be shorter than `name`; it is defined per slug in `h1Lines` and does not have to equal `name`. When the `<h1>` text is not equal to `name`, the full official name must appear as visible text in the initial HTML, in the case header, right after the `<h1>` (not inside it, not hidden, not injected by JS). `<title>`, `og:title`, `twitter:title`, `headline`, `about.name` and `BreadcrumbList` keep the official name.
- Do not emit `datePublished` or `dateModified` on any JSON-LD node. There are no real dates; do not invent them.

Official names, confirmed by Juan, including Capa Automotores (slugs stay immutable). `<h1>` (v34) is the short design title. The visible line is the `<p>` immediately after `</h1>` when that title is not `name`; `none` means that `<p>` is absent.

| Path                              | Official name              | `<h1>` (v34)     | Visible line                     |
| --------------------------------- | -------------------------- | ---------------- | -------------------------------- |
| `/trabajo/conexion-laboral`       | Conexión Laboral           | Conexión Laboral | none                             |
| `/trabajo/afectiva`               | Afectiva Comunicaciones    | Afectiva         | Afectiva Comunicaciones          |
| `/trabajo/capa-automotores`       | Capa Automotores           | Capa             | Capa Automotores                 |
| `/trabajo/suplementacion-ciencia` | Suplementación con Ciencia | SCC              | Suplementación con Ciencia (SCC) |
| `/trabajo/luxurycars`             | Luxury Cars                | Luxury Cars      | none                             |

**H1 type size.** Effective cap is 85.95px at ≥1440 (18cqi on a column of ~477.5px). The v34 CSS cap of 104px is not reached. Iris’s design criterion: accepted.

**Case document title**

- Each case `<title>` is the SEO title Jake fixed for that case. It is not built from `outcomeTitle`.
- The string includes ` | Neutro Solutions`, is at most **60 characters** counting that suffix, and is the same in `<title>`, `og:title`, and `twitter:title`.
- The visible `<h1>` is `h1Lines`. `outcomeTitle` is a field on each case in `apps/web/src/data/work-cases.ts`. `apps/web/src/data/work-cases.test.ts` pins each value and checks that the document title does not include it. `outcomeTitle` is not rendered in `WorkCasePage.astro`, and it is not the `<h1>` or the `<title>`.

- `/trabajo/conexion-laboral`: `Conexión Laboral: landing de asesoría | Neutro Solutions` (56)
- `/trabajo/afectiva`: `Afectiva Comunicaciones: sitio web | Neutro Solutions` (53)
- `/trabajo/capa-automotores`: `Capa Automotores: catálogo con stock | Neutro Solutions` (55)
- `/trabajo/suplementacion-ciencia`: `Suplementación con Ciencia: tienda online | Neutro Solutions` (60)
- `/trabajo/luxurycars`: `Luxury Cars: plataforma de autos de lujo | Neutro Solutions` (59)

**Session decisions** (Juan)

- One manual order, in one data place (`apps/web/src/data/work.ts`): Conexión Laboral, Afectiva Comunicaciones, Capa Automotores, Suplementación con Ciencia, Luxury Cars. A new case goes at the end. Luxury Cars stays outside the initial 4.
- The landing always shows 4 cards. It has no link and no button `Ver todos` to `/trabajo`.
- `/trabajo` loads 4. **Cargar más** reveals the remaining cases in batches of 4, or fewer when fewer remain. The accessible notice says `caso` or `casos`. Without JS every case is visible and the button does not appear.
- The threshold of 12 published cases stays: reopen `/trabajo` pagination and evaluate a CMS.
- The `/trabajo` `<title>` is `Casos de clientes: webs y sistemas | Neutro Solutions`.

**Más trabajo**

- Each case page lists every other published case, and not itself. Order is the manual order in `apps/web/src/data/work.ts`, with the current case removed.
- The grid has **2 columns**.

**Listings of 5 cases**

- The fifth card sits alone on a third row.

## Consequences

- Landing and `/trabajo` share the same project list and Card / Work presentation; case links are real `/trabajo/<slug>` routes.
- SEO tooling and sitemap generation assume slashless absolute URLs under `https://neutro.solutions/trabajo…`, with a single index canonical and no `?page=N` index URLs.
- Changing a published slug is an ops/content event (301), not a silent rename.
- Implementation PRs must satisfy the curl href and no-trailing-slash checks before claiming SEO readiness.
- Design follows v34 (Iris / Juan): **En producción** ships; card/case chrome avoids 1px borders except `.work-index__more` `border-top` on `/trabajo`.
- At **12** published cases, reopen `/trabajo` pagination and evaluate a CMS (code order + call performance).
- `apps/web/src/contract/jsonld.test.ts` protects the JSON-LD contract in the SEO-15 amendment. That file and `apps/web/src/contract/seo.test.ts` validate the short `<h1>` per slug. The official name visible next to the `<h1>` is a contract: the `<p>` immediately after `</h1>` for `afectiva`, `capa-automotores`, and `suplementacion-ciencia`, with no heading, in the static HTML.
- `apps/web/src/contract/mas-trabajo.test.ts` protects **Más trabajo**: every other published case, in `work.ts` order. The count is that list minus the current case.
