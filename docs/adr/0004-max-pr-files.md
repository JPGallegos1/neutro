# ADR 0004: PR size by authorship LoC (~50–1000)

## Status

Accepted (amended 2026-10-30). Juan OK via Hamilton (t361u / t362u).

The authorship size rule is **~50–1000 LoC** (lockfiles excluded). That LoC band **supersedes** the earlier hard cap of **max 10 files** per pull request. The old file-count limit no longer defines PR size for authors or reviewers.

## Context

Juan requires pull requests to stay small enough to review and to keep unrelated work out of one diff. The first version of this ADR used a hard cap of **10** counted files (soft target about **7–10**). Stacked PRs against non-`main` bases are normal in this repo, so any mechanical gate must use the PR’s declared base SHA, not only `main`.

Lockfiles (especially `pnpm-lock.yaml`) often change as a mechanical side effect of a one-line `package.json` bump. Counting them toward size would force artificial splits or discourage small dependency updates.

In practice, file count was a weak proxy: Admin MVP PRs on `main` already shipped above 10 authored files under a LoC band of about **50–1000** (lock excluded). Authorship LoC matches review cost better than file count.

## Decision

- **Authorship size (binding):** a PR should stay in about **50–1000** lines of authorship (`git diff --numstat` additions + deletions), **excluding lockfiles**. Prefer the lower half of the band when the change is easy to split. Above 1000 lines, split into stacked or sequential PRs. In a stack, each pull request's base is the previous head, and they merge in that order.
- **LoC supersedes file count:** the old **max 10 files** hard fail is **not** the size rule anymore. A PR may touch more than 10 files when LoC stays in band. Do not split solely to satisfy the retired file cap.
- **Lockfiles excluded:** basenames only, `pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, and `bun.lockb`. A nested path with one of those basenames is out of the count. `docs/pnpm-lock.yaml.txt` and `bun.lockfile` stay in the count.
- **Diff range:** `git diff --numstat BASE_SHA...HEAD_SHA`. Pass the two commits. The command inserts the three dots. `BASE_SHA` is the pull request's declared base, not only `main`.
- **No other generated-path exclusions** (no blanket `dist/`, screenshots, etc.). If a PR must ship many assets, split the stack or keep LoC in band.
- **CI:** `pnpm check:pr-authorship` fails when authorship is above 1000. The same command runs locally and in [`.github/workflows/pr-authorship.yml`](../../.github/workflows/pr-authorship.yml), job `Autoría ≤1000`. The floor of about 50 does not fail the command. There is no file-count ceiling.
- This ADR does **not** invent a docs-only shortcut past Juan’s merge OK. Merge to `main` still needs Juan’s explicit OK ([ADR 0007](0007-reglas-automaticas-y-verification-skill.md)).

## Exception

`pnpm check:pr-authorship` exits 0 above 1000 only when every item below holds. At or under 1000 it does not read the event, the body, or the timeline.

- Juan adds `excepcion-tamano-pr` in the GitHub UI. The command does not create the label.
- Timeline events for that label sort by `created_at`, then by return order. The latest `labeled` turns it on and records `actor.login`. The latest `unlabeled` turns it off. It counts only when that latest state is `labeled` by `JPGallegos1`.
- The body has `## Excepción de tamaño` outside fences and HTML comments, then `-` or `*` bullets (0–3 spaces) `Motivo:` (non-empty, colons allowed) and `Vence:` (`YYYY-MM-DD`, a real UTC date). The first of each counts. Today may equal `Vence`. The next UTC day fails (`hoy > Vence`).

## Consequences

- Oversized work is split when authorship goes past 1000 (lockfiles excluded), not when the file list crosses 10.
- A PR that only bumps deps plus lockfile stays small if authored LoC stays in band.
- Reviewers judge size by LoC and cohesion, not by file count alone.
- A red `Autoría ≤1000` check means the pull request is over 1000 and the exception does not authorize it. Authors do not ignore that check.
