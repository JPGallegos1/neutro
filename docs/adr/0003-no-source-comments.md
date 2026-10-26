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

Only tool/runtime directives required for correct tooling. Matched on the trimmed comment body. A directive name must end the body or be followed by whitespace, except where the table names another terminator (`:` for webpack, `=` for `sourceMappingURL`). Raw body for the `/*!` banner (block only); trimmed body and Line type for `///`.

| Pattern                                                                                                                                                               | Why                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Line comments only: `/// <reference …>`, `/// <amd-module …>`, `/// <amd-dependency …>`                                                                               | Real TypeScript/AMD directives. The comment type must be Line. A block is **not** exempt, including `/* / <reference prosa */`. Prose like `/// Explain this` is **not** exempt. The name must end or be followed by whitespace.              |
| `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, `@ts-check`                                                                                                          | The name must end the body or be followed by whitespace. `@ts-esto-es-prosa` is **not** exempt.                                                                                                                                               |
| `eslint-` / `oxlint-` plus `disable`, `disable-line`, `disable-next-line`, or `enable`                                                                                | Inline suppressions. The keyword must end the body or be followed by whitespace. `eslint-plugin`, `oxlint-is …`, `eslint-ignore`, and `oxlint-ignore` are **not** exempt.                                                                     |
| `prettier-ignore`, `oxfmt-ignore`, `@vite-ignore`                                                                                                                     | Formatter and Vite directives. The name must end the body or be followed by whitespace. `prettier-ignoreAlgo`, `oxfmt-ignoreAlgo`, and `@vite-ignoreAlgo` are **not** exempt.                                                                 |
| `webpackChunkName`, `webpackExclude`, `webpackExports`, `webpackFetchPriority`, `webpackIgnore`, `webpackInclude`, `webpackMode`, `webpackPrefetch`, `webpackPreload` | Webpack magic comments from the webpack docs. After the name: end, whitespace, or `:`. `webpackZprosa` is **not** exempt. The old shorthand `webpack*` was wider than this list.                                                              |
| `v8 ignore`, `c8 ignore`, `istanbul ignore`                                                                                                                           | Coverage directives. The phrase must end the body or be followed by whitespace. `v8 ignoreAlgo`, `c8 ignoreAlgo`, and `istanbul ignoreAlgo` are **not** exempt.                                                                               |
| `@__PURE__`, `#__PURE__`, `@__NO_SIDE_EFFECTS__`, `#__NO_SIDE_EFFECTS__`                                                                                              | Bundler purity annotations. The name must end the body or be followed by whitespace. `@__PURE__foo` is **not** exempt.                                                                                                                        |
| `@license` or `@preserve` at the start of the trimmed body                                                                                                            | The marker must end the body or be followed by whitespace. `@licenseFoo` is **not** exempt.                                                                                                                                                   |
| Block `/*!` whose raw body is `!`, then only spaces, tabs, newlines, or `*`, then `@license` or `@preserve`                                                           | The marker is the first word. Exempt: `/*! @license MIT */`, a multiline `/*!\n * @license … */`, and `/*! @preserve */`. Not exempt: `/*! nota sobre @license */`, `/*! texto\n * @license */`, `/*! @licensefoo */`, `/*!(@license MIT)*/`. |
| `sourceMappingURL` or `# sourceMappingURL`                                                                                                                            | The name must end the body, be followed by whitespace, or be followed by `=`. `sourceMappingURLAlgo` is **not** exempt.                                                                                                                       |

`/*!(@license MIT)*/` is **not** exempt. After `!`, only spaces, tabs, newlines, and asterisks may appear before the marker. `(` is none of those, so `@license` is not the first word.

No license header is required in this repo today. `@license` and `@preserve` stay allowed when they start the trimmed body, or when they are the first word of a `/*!` block as specified above.

Meaning that would have lived in a comment must go into names, types, tests, or an ADR/docs file.

## Consequences

- Explanatory JSDoc and line/block comments fail lint locally and in CI.
- `oxlint --fix` deletes disallowed comments but **preserves token boundaries** (inserts a space when bare removal would glue neighbors, e.g. `typeof/* x */value` → `typeof value`). Authors must still move intent into code or docs first when the comment carried real constraints.
- Parallel feature branches must strip existing comments (or express them elsewhere) before they stay green.
- Rule helpers and a real `oxlint` run over temp files are covered by `pnpm test:lint-rules`.
