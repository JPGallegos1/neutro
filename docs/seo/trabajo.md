# SEO criteria: Trabajo

English prose. User-facing strings below are Spanish and must ship as written unless Jake (SEO) revises them.

**Status:** Accepted with [ADR 0005](../adr/0005-trabajo-routing-and-seo.md) (Juan, 26/10/2026). Design reference: Iris **v34**. Reviewers: Jake (SEO), Melody / Iris (design). Pagination: opción A (Juan, 26/10/2026) — single index URL, no `?page=N`.

## Surfaces

| URL                                       | Role                      |
| ----------------------------------------- | ------------------------- |
| `https://neutro.solutions/trabajo`        | Index of selected work    |
| `https://neutro.solutions/trabajo/<slug>` | Individual case / project |

URLs are **slashless**. Configure Astro with exactly `trailingSlash: 'never'`. Do not publish trailing-slash variants as canonical. Do **not** publish paginated index URLs (`?page=N`).

## Index: `/trabajo`

### Copy and UI

- Header title (ES): `TRABAJO`
- Visible intro (ES): `Explorá nuestro trabajo seleccionado.`
- Card grid matches the landing Trabajo section (same Card / Work components and projects).
- Landing home always shows **`LANDING_WORK_LIMIT` (4)** cards; **Cargar más** lives only on `/trabajo`.
- With JS: **4** cases visible initially on the index; if there are **more than four** cases, show **Cargar más** (label ES: `Cargar más`). Each click reveals **4 more** cases already in the HTML.
- Without JS: all published cases are visible; the load control does not appear as an available action.

### Title and structured data

- Document title: `Casos y proyectos | Neutro Solutions`
- JSON-LD: `CollectionPage` + `ItemList` (items = case URLs in the same order as the grid; no paginated URLs).

### Canonical

Self-referencing and absolute. **Only** this index canonical:

```html
<link rel="canonical" href="https://neutro.solutions/trabajo" />
```

No query string. No trailing-slash variants. No `?page=N` canonicals.

## Case: `/trabajo/<slug>`

### Title and structured data

- Document title pattern: `<Cliente>: <qué se resolvió> | Neutro Solutions`
- Meta description: **140–155 characters**, from real approved data only.
- JSON-LD: `Article` **or** `CreativeWork`, plus `BreadcrumbList`.
- Breadcrumb trail: Inicio → Trabajo → current case (Spanish labels in the visible breadcrumb if shown).
- Exactly **one** `<h1>` per case page.
- Show **2–3 related cases** on each case page.

### Canonical

```html
<link rel="canonical" href="https://neutro.solutions/trabajo/<slug>" />
```

## Slug rules

| Rule      | Detail                                                    |
| --------- | --------------------------------------------------------- |
| Case      | Lowercase                                                 |
| Separator | Hyphen between words                                      |
| Accents   | Strip (é→e, ü→u, …)                                       |
| ñ         | Map to `n`                                                |
| Length    | **Maximum 4 words**                                       |
| Stopwords | Not allowed                                               |
| Dates     | Not allowed (no years, months, or numeric date fragments) |
| Stability | Immutable after publish; renames need a **301**           |

**Published slugs (5)**

- `/trabajo/conexion-laboral`
- `/trabajo/afectiva`
- `/trabajo/capa-automotores`
- `/trabajo/suplementacion-ciencia` (no stopword; content file may still be named `suplementacion-con-ciencia`)
- `/trabajo/luxurycars`

There is no Lina case in the published set.

Examples of _shape_ only:

- `cliente-producto` ✓
- `Cliente Producto` ✗
- `cliente_producto` ✗
- `año-nuevo` → `ano-nuevo` ✓
- `el-caso-de-2024` ✗ (stopword + date)

## “Cargar más” crawl rules

These are non-negotiable for SEO:

1. With JS: show **4** cases initially; button only when count **> 4**; each click reveals **4 more**.
2. **Server HTML** includes an `<a href="/trabajo/<slug>">` for **every** published case, including items beyond the first four.
3. Items 5+ may be visually hidden only after JS applies client reveal state (for example a class). Without JS, all cases remain visible.
4. The button **only reveals** nodes already present in the server HTML. **No fetch** — never request the network.
5. **No** `?page=N` links, responses, or canonicals for the index.
6. **Sitemap** lists every published case URL and the single index URL `/trabajo`.
7. **Scale trigger:** at **12** published cases, reopen the `/trabajo` pagination decision and also evaluate a CMS, according to the tactical order of the code and call performance (see ADR 0005).

### Verification

```bash
# Without executing JavaScript, every case href must appear in the response body.
curl -sS https://neutro.solutions/trabajo | grep -oE '/trabajo/[a-z0-9-]+' | sort -u

# No Trabajo href may end with a trailing slash.
! curl -sS https://neutro.solutions/trabajo | grep -oE 'href="[^"]*trabajo[^"]*"' | grep -q '/"'

# No paginated index links.
! curl -sS https://neutro.solutions/trabajo | grep -q 'page='
```

Local/preview builds use the same checks against the preview origin. A passing case-href check means the set of hrefs equals the set of published slugs.

## Data and placeholders

Titles, meta descriptions, H1, and schema text fields **must** come from real case data fields (or the shared work / work-cases modules). Meta description length is **140–155 characters**.

Until an approved **outcome** line exists for the document title pattern `<Cliente>: <qué se resolvió>`, do **not** invent it. Use only approved segments; mark gaps explicitly in implementation PRs.

| Field                       | Placeholder form (only when unapproved) |
| --------------------------- | --------------------------------------- |
| Outcome / “qué se resolvió” | `{qué se resolvió}`                     |

Never invent outcome lines solely to fill the title pattern.

## Design (v34)

- Reuse landing **Card / Work** components and the landing Trabajo grid for cards.
- Case pages follow Iris **v34**: sticky title column, visible **En producción** on cards and cases, primary **Visitar sitio**, 16:9 cover, sectioned body + quote; **no 1px dividers**, except the `border-top` on `.work-index__more` above **Cargar más** on `/trabajo` (see `AGENTS.md`).
- Primary **Cargar más** button: `#2B4BFF`, centered on desktop, left-aligned on mobile.
- Header nav label `Trabajo` links to `/trabajo`.

## Out of scope (this doc)

- Analytics events on Trabajo clicks.
- Non-Spanish locales or `hreflang`.
