# SEO criteria: Trabajo

English prose. User-facing strings below are Spanish and must ship as written unless Jake (SEO) revises them.

**Status:** Criteria only. No implementation in this change. Design v31 is pending Juan’s approval. Companion decision: [`docs/adr/0002-trabajo-routing-and-seo.md`](../adr/0002-trabajo-routing-and-seo.md).

## Surfaces

| URL                                       | Role                      |
| ----------------------------------------- | ------------------------- |
| `https://neutro.solutions/trabajo`        | Index of selected work    |
| `https://neutro.solutions/trabajo?page=N` | Paginated index (scale)   |
| `https://neutro.solutions/trabajo/<slug>` | Individual case / project |

URLs are **slashless**. Configure Astro with exactly `trailingSlash: 'never'`. Do not publish trailing-slash variants as canonical.

## Index: `/trabajo`

### Copy and UI

- Header title (ES): `TRABAJO`
- Visible intro (ES): `Explorá nuestro trabajo seleccionado.`
- Card grid matches the landing Trabajo section (same Card / Work components and projects).
- **4** cases visible initially.
- If there are **more than four** cases, show **Cargar más** (label ES: `Cargar más`). Each click reveals **4 more** cases.

### Title and structured data

- Document title: `Casos y proyectos | Neutro Solutions`
- JSON-LD: `CollectionPage` + `ItemList` (items = case URLs in the same order as the grid).

### Canonical

Self-referencing and absolute for the URL being served:

```html
<link rel="canonical" href="https://neutro.solutions/trabajo" />
```

For paginated index responses:

```html
<link rel="canonical" href="https://neutro.solutions/trabajo?page=2" />
```

Each `?page=N` has its own self-referencing canonical. Do not collapse page 2+ onto the bare `/trabajo` canonical. No trailing-slash variants.

## Case: `/trabajo/<slug>`

### Title and structured data

- Document title pattern: `<Cliente>: <qué se resolvió> | Neutro Solutions`
- Case description: **140–155 characters**, from real approved data only.
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
| Length    | **Hard maximum 3–4 words**                                |
| Stopwords | Not allowed                                               |
| Dates     | Not allowed (no years, months, or numeric date fragments) |
| Stability | Immutable after publish; renames need a **301**           |

**Decided vs placeholder**

- `/trabajo/lina` — **decided** slug. Title and case data remain **unconfirmed**.
- Other `/trabajo/<slug>` values — placeholders until published.

Examples of _shape_ only (not additional approved project names):

- `cliente-producto` ✓
- `Cliente Producto` ✗
- `cliente_producto` ✗
- `año-nuevo` → `ano-nuevo` ✓
- `el-caso-de-2024` ✗ (stopword + date)

## “Cargar más” crawl rules

These are non-negotiable for SEO:

1. Show **4** cases initially; button only when count **> 4**; each click reveals **4 more**.
2. **Server HTML** includes an `<a href="/trabajo/<slug>">` for **every** published case, including items beyond the first four.
3. Items 5+ may be visually hidden (CSS / client reveal state).
4. The button **only reveals** existing nodes for the incremental UI path. No `fetch` of card HTML as the sole source of those hrefs.
5. **Scale fallback:** also include a real server-rendered `<a href="/trabajo?page=2">` (and further `?page=N` as needed). JS may intercept for in-place reveal; without JS, navigation loads that page. Each `?page=N` is a real response with its own self-canonical.
6. **Sitemap** lists every published case URL and the index (include paginated index URLs if they are part of the public crawl surface).

### Verification

```bash
# Without executing JavaScript, every case href must appear in the response body.
curl -sS https://neutro.solutions/trabajo | grep -oE '/trabajo/[a-z0-9-]+' | sort -u

# No Trabajo href may end with a trailing slash.
curl -sS https://neutro.solutions/trabajo | grep -oE 'href="[^"]*trabajo[^"]*"' | grep '/"' && exit 1 || true
```

Local/preview builds use the same checks against the preview origin. A passing case-href check means the set of hrefs equals the set of published slugs.

## Data and placeholders

Titles, meta descriptions, H1, case descriptions (140–155 chars), and schema text fields **must** come from real case data fields (or the shared work data module once extended).

The slug `/trabajo/lina` is **decided**. Lina’s **title and data** (and all other provisional cards’ titles/data) stay **unconfirmed**. Until content is approved, use clearly marked placeholders only, for example:

| Field                       | Placeholder form          |
| --------------------------- | ------------------------- |
| Client name                 | `{Cliente}`               |
| Outcome / “qué se resolvió” | `{qué se resolvió}`       |
| Short description           | `{Descripción <id>}`      |
| Meta description            | `{Meta descripción <id>}` |

Never invent outcome lines solely to fill the title pattern.

## Design (v31)

- Reuse landing **Card / Work** components and the landing Trabajo grid.
- Primary **Cargar más** button: `#2B4BFF`, centered on desktop, left-aligned on mobile.
- Header nav label `Trabajo` links to `/trabajo`.

### Open items (Juan)

- Approve design v31.
- Decide on the card **1px border**.
- Decide on the **En producción** label.

## Out of scope (this doc)

- Analytics events on Trabajo clicks.
- Non-Spanish locales or `hreflang`.
- Implementation PRs (follow ADR 0002 when building).
