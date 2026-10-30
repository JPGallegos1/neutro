# ADR 0004: PR size by authorship LoC (~50–1000)

## Status

Accepted (amended 2026-10-30). Juan OK via Hamilton (t361u / t362u).

The authorship size rule is **~50–1000 LoC** (lockfiles excluded). That LoC band **supersedes** the earlier hard cap of **max 10 files** per pull request. The old file-count limit no longer defines PR size for authors or reviewers.

## Context

Juan requires pull requests to stay small enough to review and to keep unrelated work out of one diff. The first version of this ADR used a hard cap of **10** counted files (soft target about **7–10**). Stacked PRs against non-`main` bases are normal in this repo, so any mechanical gate must use the PR’s declared base SHA, not only `main`.

Lockfiles (especially `pnpm-lock.yaml`) often change as a mechanical side effect of a one-line `package.json` bump. Counting them toward size would force artificial splits or discourage small dependency updates.

In practice, file count was a weak proxy: Admin MVP PRs on `main` already shipped above 10 authored files under a LoC band of about **50–1000** (lock excluded). Authorship LoC matches review cost better than file count.

## Decision

- **Authorship size (binding):** a PR should stay in about **50–1000** lines of authorship (`git diff` additions + deletions), **excluding lockfiles**. Prefer the lower half of the band when the change is easy to split. Above ~1000 LoC, split into stacked or sequential PRs.
- **LoC supersedes file count:** the old **max 10 files** hard fail is **not** the size rule anymore. A PR may touch more than 10 files when LoC stays in band. Do not split solely to satisfy the retired file cap.
- **Lockfiles excluded (unchanged):** basenames only — `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `bun.lockb`. They do not count toward authorship LoC.
- **Diff range (unchanged):** measure against `git diff $BASE_SHA...$HEAD_SHA` with `BASE_SHA` / `HEAD_SHA` from the pull request event (declared base, not only `main`).
- **No other generated-path exclusions** (no blanket `dist/`, screenshots, etc.). If a PR must ship many assets, split the stack or keep LoC in band.
- **CI note:** the workflow job **Max 10 files** (`tools/ci/check-pr-file-count.mjs` + `.github/workflows/pr-file-count.yml`) may still run as a historical check. **Policy follows this ADR’s LoC rule**, not that file cap. Changing or retiring the job is a separate CI change, out of scope for this docs amendment.
- This ADR does **not** invent a docs-only shortcut past Juan’s merge OK. Merge to `main` still needs Juan’s explicit OK ([ADR 0007](0007-reglas-automaticas-y-verification-skill.md)).

## Consequences

- Oversized work is split when authorship LoC goes past ~1000 (lockfiles excluded), not when the file list crosses 10.
- A PR that only bumps deps plus lockfile stays small if authored LoC stays in band.
- Reviewers judge size by LoC and cohesion, not by file count alone.
- Until CI is updated in a later PR, a red **Max 10 files** job can disagree with this policy; authors follow the LoC rule and note the supersede in the PR body when needed.
