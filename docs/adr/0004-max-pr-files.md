# ADR 0004: Max 10 files per pull request

## Status

Accepted

## Context

Juan requires pull requests to stay small: at most **10** files changed, targeting about **7–10**. Large PRs are hard to review and encourage mixing unrelated work. Stacked PRs against non-`main` bases are normal in this repo, so the gate must use the PR’s declared base SHA, not only `main`.

Lockfiles (especially `pnpm-lock.yaml`) often change as a mechanical side effect of a one-line `package.json` bump. Counting them toward the limit would force artificial splits or discourage small dependency updates.

## Decision

- CI job **Max 10 files** runs on every `pull_request` (any base branch).
- Count is `git diff --name-only $BASE_SHA...$HEAD_SHA` with `BASE_SHA` / `HEAD_SHA` from the pull request event.
- Soft target for authors: 7–10 files. Hard fail: more than **10** counted files.
- **Excluded from the count (minimal):** lockfile basenames only — `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`.
- No other generated-path exclusions (no blanket `dist/`, screenshots, etc.). If a PR must ship many assets, split the stack.
- Implementation: `tools/ci/check-pr-file-count.mjs` + `.github/workflows/pr-file-count.yml`.

## Consequences

- Oversized PRs fail CI with a message to split into stacked PRs.
- A PR that only bumps deps plus lockfile can stay small if authored files stay ≤10.
- Existing large open PRs need to be split before this check can pass on those branches; splitting is a follow-up, not part of this ADR’s merge.
