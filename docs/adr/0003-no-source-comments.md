# ADR 0003: No source comments

## Status

Accepted

## Context

Juan does not want explanatory, documentation, or pseudo-code comments in source. A review on the QR redirects work flagged module-level JSDoc that restated what names and types already said. Oxlint has no native “ban all comments” rule (`no-warning-comments` only targets TODO/FIXME-style terms). The Vite/oxc toolchain already ships oxlint, so a small oxlint JS plugin is the lightest enforcement that still uses the repo linter instead of a second stack (ESLint) or an ad-hoc grep that cannot share disable directives.

Numbering: this ADR is **0003** so it does not collide with **0001** (analytics, landing-base stack) or **0002** (Trabajo SEO / QR redirect ADRs on parallel open branches).

## Decision

- Enforce `neutro/no-comments` via `tools/oxlint/no-comments.js` registered in `.oxlintrc.json`.
- Root script: `pnpm lint` → `oxlint -A all -D neutro/no-comments .` so CI only fails on this policy (not unrelated default oxlint categories).
- CI runs `pnpm lint` and fails the job on any violation.
- Scope: JavaScript/TypeScript (`.js`/`.mjs`/`.cjs`/`.ts`/`.tsx`/…) and Astro **script/frontmatter** blocks (oxlint’s Astro support). HTML template text and CSS (including `<style>` in `.astro`) are outside oxlint; do not put prose there either, but this ADR does not claim CSS/HTML enforcement.

### Allowed exceptions (minimal)

Only tool/runtime directives required for correct tooling. Matched on the trimmed comment body:

| Pattern                                                                                           | Why                                                                              |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Triple-slash directives only: `/// <reference …>`, `/// <amd-module …>`, `/// <amd-dependency …>` | Real TypeScript/AMD directives. Prose like `/// Explain this` is **not** exempt. |
| `@ts-*`                                                                                           | `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, `@ts-check`                     |
| `eslint-*` / `oxlint-*`                                                                           | Inline suppressions                                                              |
| `prettier-ignore` / `oxfmt-ignore`                                                                | Formatter directives                                                             |
| `@vite-ignore` / `webpack*` magic comments                                                        | Bundler directives                                                               |
| `v8 ignore` / `c8 ignore` / `istanbul ignore`                                                     | Coverage directives                                                              |
| `@__PURE__` / `#__PURE__` / `@__NO_SIDE_EFFECTS__` / `#__NO_SIDE_EFFECTS__`                       | Bundler purity annotations                                                       |
| `@license` / `@preserve` / leading `!` (`/*! … */`)                                               | Legally required or preserve markers                                             |
| `sourceMappingURL`                                                                                | Source map footers                                                               |
| `global` / `globals` / `exported`                                                                 | Legacy ESLint/JSHint globals (if ever needed)                                    |

No license header is required in this repo today; `@license`/`@preserve` stay allowed if one appears later.

Meaning that would have lived in a comment must go into names, types, tests, or an ADR/docs file.

## Consequences

- Explanatory JSDoc and line/block comments fail lint locally and in CI.
- `oxlint --fix` deletes disallowed comments but **preserves token boundaries** (inserts a space when bare removal would glue neighbors, e.g. `typeof/* x */value` → `typeof value`). Authors must still move intent into code or docs first when the comment carried real constraints.
- Parallel feature branches must strip existing comments (or express them elsewhere) before they stay green.
- Rule helpers are covered by `pnpm test:lint-rules`.
