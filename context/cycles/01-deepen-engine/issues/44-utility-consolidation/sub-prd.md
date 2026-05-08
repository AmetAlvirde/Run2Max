# Parent Issue #44 — Utility consolidation

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Collapse the four duplicated utility functions identified in the cycle PRD into
a single canonical home each, and point every existing caller at the canonical
home so no duplicates remain.

Today, four utilities are copy-pasted across the workspace:

- **`addDays(dateStr, days): string`** — pure UTC ISO-date math. **7 sites**:
  `packages/engine/src/plan/{associate,build,reconcile,status}.ts`,
  `packages/cli/src/commands/{quantify,plan/status,plan/sync}.ts`. All bodies
  are byte-identical.
- **`clonePlan(plan: Plan): Plan`** — three-level nested spread sufficient for
  immutable updates. **2 sites**: `packages/engine/src/plan/{sync,adjust}.ts`.
  Bodies are byte-identical.
- **`transformKeys(value): unknown`** (snake-case → camel-case object-key
  rewrite, applied before valibot validation). **2 forward sites**:
  `packages/engine/src/{plan,config}/schema.ts`. The CLI's `plan/create.ts`
  has the inverse `transformKeysToSnake` (camel → snake) used when emitting
  YAML — same shape, opposite direction.
- **`getDistance(record): number | null`** (or `number` in one site) — reads
  `strydDistance` falling back to `distance`. **4 sites**:
  `packages/engine/src/computations/{segments,elevation,summary,km-splits}.ts`.
  The km-splits copy returns `number` with `?? 0`; the other three return
  `number | null`. The four-callers signature reconciliation is part of this
  parent's scope.

This parent does not redesign any utility. It moves them into one home each
and reconciles `getDistance`'s return type so the canonical signature is
honest. After this parent closes:

- `addDays` lives in one place and every caller imports it from there.
- `clonePlan` lives in one place; `plan/sync.ts` and `plan/adjust.ts` both
  import it.
- `snakeToCamel` / `camelToSnake` (and the recursive key-walking versions)
  live in one place and the three schema/emit sites import them.
- `getDistance` lives in one place with one signature; km-splits inlines its
  own `?? 0` at the call site if the canonical signature is `number | null`.

User-facing behaviour stays byte-identical. CLI fixtures continue to pass.

## Owned user stories

From the cycle PRD:

- As a maintainer adding a feature that needs to add days to an ISO date,
  shallow-clone a Plan, transform snake/camel object keys, or read a record's
  distance, I import one symbol from a known location, so I do not write the
  fifth (or eighth) copy of the same helper.

A success-signal story from the cycle PRD also lands here:

- A maintainer running `grep -rn "function addDays\|function clonePlan\|function transformKeys\|function getDistance"` after the cycle finds **one
  hit per utility**, not four to seven. (Cycle PRD success metric #1: "Zero
  call sites duplicating `flattenWeeks`, `clonePlan`, `addDays`,
  `transformKeys`, or `getDistance` after the cycle. Verified by grep.")

`flattenWeeks` is already gone — it was consumed by `walkPlan` in parent #35.
This parent owns the remaining four utilities listed in the metric.

## Encounter statements affecting this scope

- A maintainer opening a plan-touching module that needs to advance a date by
  N days first encounters a single named import for `addDays` — not a
  function literal at the bottom of the file.
- A maintainer opening `packages/engine/src/plan/sync.ts` or `adjust.ts`
  first encounters a single imported `clonePlan` rather than a private copy
  of the three-level nested spread.
- A maintainer opening a schema file (`plan/schema.ts`, `config/schema.ts`)
  or a YAML emitter (`cli/commands/plan/create.ts`) first encounters one
  named import for the case-transform helpers — not a private
  `snakeToCamel` / `camelToSnake` copy.
- A maintainer opening the four split-row computations
  (`segments`, `km-splits`, `elevation`, `summary`) first encounters a
  shared `getDistance` import with one signature, not four near-identical
  private copies that disagree on whether the return type is nullable.

## Directional dependencies on other sub-PRDs

- Upstream: parent #32 (closed) — `Plan` is a stable named interface;
  `clonePlan` consumes it. No re-opening.
- Upstream: parent #35 (closed) — `walkPlan` already consumed `flattenWeeks`.
  This parent does not touch the walker; the remaining flatten-style
  duplication has already been eliminated.
- Upstream: parent #38 (closed) — `aggregateBucket` is unrelated to record
  helpers, but `getDistance` is used at the *bucketing* sites (segments,
  km-splits) that feed `aggregateBucket`. The bucketing layer stays
  unchanged; only the helper is consolidated.
- Upstream: parent #41 (closed) — engine/presentation separation kept
  `addDays` private to `plan/status.ts`. This parent relocates that local
  copy along with the other six.
- Downstream: the public-export rewrite parent (last in the cycle) regroups
  `index.ts`. If any consolidated utility is exposed publicly (e.g.
  `addDays` because the CLI imports it across the package boundary), the
  index-rewrite parent decides whether it belongs under a Periodization
  grouping, an infrastructure grouping, or stays internal-only via a
  CLI-internal duplication that this parent declines to introduce. This
  parent records its choice; the index-rewrite parent ratifies the
  grouping.
- Sideways: no behaviour change. `quantify` output and `plan` command output
  for the existing fixtures stay byte-identical.

## Domain language

`ubiquitous-language.md` does not include `addDays`, `clonePlan`,
`transformKeys`, or `getDistance` as glossary terms. They are internal
infrastructure helpers — not domain concepts. This parent does not introduce
any public-facing domain term.

`sdp-domain-validate` is not required for this parent unless the
design-it-twice in sub-issue #45 surfaces a candidate domain name (e.g. if
co-locating helpers with a domain module suggests a new noun like "Plan
Calendar" for the date helper). Pre-resolution preference: keep them as
infrastructure under existing module-shape conventions; do not invent
domain nouns for utility consolidation.
