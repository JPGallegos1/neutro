# SEO criteria: Trabajo

English prose. User-facing strings below are Spanish and must ship as written unless Jake (SEO) revises them.

**Status:** Criteria only. No implementation in this change. Design v31 is pending Juan’s approval. Companion decision: [`docs/adr/0002-trabajo-routing-and-seo.md`](../adr/0002-trabajo-routing-and-seo.md).

## Surfaces

| URL                                       | Role                      |
| ----------------------------------------- | ------------------------- |
| `https://neutro.solutions/trabajo`        | Index of selected work    |
| `https://neutro.solutions/trabajo/<slug>` | Individual case / project |

URLs are **slashless**. Configure Astro with `trailingSlash: 'never'` (or `false`). Do not publish trailing-slash variants as canonical.

## Index: `/trabajo`

### Copy and UI

- Visible intro (ES): `Explorá nuestro trabajo seleccionado`
- Card grid matches the landing Trabajo section (same projects, same card fields).
- If there are **more than four** cases, show a **Cargar más** control (label ES: `Cargar más`).

### Title and structured data

- Document title: `Casos y proyectos | Neutro Solutions`
- JSON-LD: `CollectionPage` + `ItemList` (items = case URLs in the same order as the grid).

### Canonical

```html
<link rel="canonical" href="https://neutro.solutions/trabajo" />
```

Self-referencing and absolute. No query-string or trailing-slash variants.

## Case: `/trabajo/<slug>`

### Title and structured data

- Document title pattern: `<Cliente>: <qué se resolvió> | Neutro Solutions`
- JSON-LD: `Article` **or** `CreativeWork`, plus `BreadcrumbList`.
- Breadcrumb trail: Inicio → Trabajo → current case (Spanish labels in the visible breadcrumb if shown).
- Exactly **one** `<h1>` per case page.

### Canonical

```html
<link rel="canonical" href="https://neutro.solutions/trabajo/<slug>" />
```

## Slug rules

| Rule      | Detail                                          |
| --------- | ----------------------------------------------- |
| Case      | Lowercase                                       |
| Separator | Hyphen between words                            |
| Accents   | Strip (é→e, ü→u, …)                             |
| ñ         | Map to `n`                                      |
| Length    | Prefer max 3–4 words                            |
| Stability | Immutable after publish; renames need a **301** |

Examples of _shape_ only (not approved project names):

- `cliente-producto` ✓
- `Cliente Producto` ✗
- `cliente_producto` ✗
- `año-nuevo` → `ano-nuevo` ✓

## “Cargar más” crawl rules

These are non-negotiable for SEO:

1. **Server HTML** includes an `<a href="/trabajo/<slug">` for **every** published case, including items beyond the first four.
2. Items 5+ may be visually hidden (CSS / client reveal state).
3. The button **only reveals** existing nodes. No `fetch`, no “load page 2” request, no injecting links after hydration as the sole source of those hrefs.
4. **Sitemap** lists every published case URL (and the index).

### Verification

```bash
# Without executing JavaScript, every case href must appear in the response body.
curl -sS https://neutro.solutions/trabajo | grep -oE '/trabajo/[a-z0-9-]+' | sort -u
```

Local/preview builds use the same check against the preview origin. A passing check means the set of hrefs equals the set of published slugs.

## Data and placeholders

Titles, meta descriptions, H1, and schema text fields **must** come from real case data fields (or the shared work data module once extended).

Do **not** treat current landing stubs as final SEO copy. In particular, **Lina** (and any other provisional card) is **unconfirmed**. Until content is approved, use clearly marked placeholders only, for example:

| Field                       | Placeholder form          |
| --------------------------- | ------------------------- |
| Client name                 | `{Cliente}`               |
| Outcome / “qué se resolvió” | `{qué se resolvió}`       |
| Short description           | `{Descripción <id>}`      |
| Meta description            | `{Meta descripción <id>}` |

Never invent outcome lines solely to fill the title pattern.

## Out of scope (this doc)

- Visual layout, type, and chrome (design v31).
- Analytics events on Trabajo clicks.
- Non-Spanish locales or `hreflang`.
- Implementation PRs (follow ADR 0002 when building).
