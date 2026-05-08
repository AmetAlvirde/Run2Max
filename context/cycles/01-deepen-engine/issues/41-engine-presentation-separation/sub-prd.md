# Parent Issue #41 — Engine/presentation separation

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Move plan-status presentation out of `@run2max/engine`'s logic layer into a
dedicated formatter module, and rewrite the tests that currently assert on
rendered strings so they assert on structural status data instead.

Today, `packages/engine/src/plan/status.ts` mixes two concerns:

- **Computation:** `getPlanStatus(plan, today, options): PlanStatus` walks the
  plan, classifies each week (`ok`, `deviated`, `current`, `unsynced_past`,
  `future`), and returns structural data.
- **Presentation:** `formatDefaultView(status)` and `formatFullView(status)`
  turn that structural data into multi-line strings (header, milestones,
  unsynced groupings, mesocycle/fractal layout with the `^ current` caret).

The PRD's encounter statement is explicit: "A maintainer opening
`packages/engine/src/plan/status.ts` first encounters pure status computation;
rendering is somewhere under `formatters/`." Today they encounter both.

`packages/engine/src/plan/status.test.ts` (522 lines) compounds the coupling:
~17 of its assertions check rendered strings produced by the formatters, so a
behaviour-preserving refactor of either layer requires touching string
fixtures even when the underlying status logic is unchanged.

After this parent closes:

- `plan/status.ts` exports `getPlanStatus` and the status data types only. It
  imports nothing from `formatters/`.
- `formatters/plan.ts` exports `formatDefaultView` and `formatFullView`,
  consuming the `PlanStatus` shape from `plan/status.ts`. It does no plan
  computation of its own.
- `plan/status.test.ts` asserts on the structural `PlanStatus` shape and is
  stripped of all rendered-string assertions.
- A new `formatters/plan.test.ts` holds the rendering assertions that moved.
- The CLI (`commands/plan/status.ts`, `commands/plan/adjust.ts`) imports
  `formatDefaultView` / `formatFullView` from the formatters surface, not
  from `plan/status.ts`. The engine's public surface re-exports them from
  the formatters module.

User-facing behaviour (CLI output for `run2max plan status`,
`run2max plan adjust`) stays byte-identical against existing fixtures.

## Owned user stories

From the cycle PRD:

- As a maintainer changing how a Plan status is rendered, I edit a formatter
  module without touching `getPlanStatus`, so I cannot accidentally change
  the computed status while editing presentation.
- As a maintainer running the test suite after a behaviour-preserving Plan
  refactor, the tests pass without my having to update string assertions
  that check rendered output, so refactoring is not gated on snapshot
  rewriting.

A success-signal story from the cycle PRD also lands here:

- A future maintainer can delete `formatters/plan.ts` and the engine still
  type-checks and tests still pass for the logic layer (deletion test for
  the engine/presentation seam).

## Encounter statements affecting this scope

- A maintainer opening `packages/engine/src/plan/status.ts` first encounters
  pure status computation: `getPlanStatus`, the data types it returns, and
  the small private helpers it needs (e.g. `addDays` for the past/future
  marker boundary). No rendering, no string-building.
- A maintainer opening `packages/engine/src/formatters/plan.ts` first
  encounters two pure functions over `PlanStatus` — one per view — and the
  small private formatting helpers (`buildHeader`, `relativeLabel`,
  `weekToFullToken`, the meso/fractal grouping). No plan computation, no
  date math beyond labels.
- A maintainer opening `packages/engine/src/plan/status.test.ts` first
  encounters tests asserting on the `PlanStatus` data shape — markers,
  milestones, unsynced groupings, deviation reports — without rendered
  strings.
- A maintainer opening `packages/engine/src/formatters/plan.test.ts` first
  encounters rendering tests that build a `PlanStatus` directly (or via
  `getPlanStatus`) and assert on the resulting strings.
- A maintainer opening `packages/cli/src/commands/plan/status.ts` and
  `packages/cli/src/commands/plan/adjust.ts` first encounters imports from
  the engine's formatters surface, not from `plan/status.ts`.

## Directional dependencies on other sub-PRDs

- Upstream: parent #32 (closed) — `Plan` and the named plan-family interfaces
  are stable. `PlanStatus`, `WeekStatusEntry`, `NextMilestone`, and
  `WeekMarker` already live in `plan/status.ts`; this parent moves the
  formatters away from them, not the types.
- Upstream: parent #35 (closed) — `walkPlan` is consumed by `getPlanStatus`.
  No change to the walker's surface.
- Upstream: parent #38 (closed) — split aggregation is unrelated to plan
  status; mentioned only because the cycle PRD's "behaviour-preserving"
  contract continues to bind here.
- Downstream: the helper-consolidation parent will fold `addDays` into a
  single home. `plan/status.ts` currently has its own `addDays`; this parent
  keeps it in place, possibly relocated to a private helper module if the
  separation surfaces a natural boundary, but does not own the
  cross-package consolidation.
- Downstream: the public-export rewrite parent (last in the cycle) regroups
  `index.ts` so `formatDefaultView` / `formatFullView` sit under a
  presentation grouping, not under plan logic. This parent moves the
  *implementation* and re-exports it; final grouping shape is settled in
  the index-rewrite parent.
- Sideways: no behaviour change. CLI fixtures for `plan status` /
  `plan adjust` stay byte-identical.

## Domain language

`ubiquitous-language.md` does not include "plan status" or "plan view" as
glossary terms today. They are internal seam names — observable to engine
maintainers, not to runners. This parent does not introduce a public-facing
domain term: `getPlanStatus` and the two view formatters are already in the
engine's surface, and the parent only relocates the formatters.

If the relocation surfaces a name that maintainers use in code review or
PRDs (e.g. "Plan Status" as a concept distinct from `getPlanStatus` the
function), `sdp-domain-validate` runs before sub-issue close to decide
whether to add it to the glossary.

The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` open question on whether
`formatters/plan.ts` exposes a small public formatting API or stays
CLI-internal is decided here. Pre-resolution preference (recorded so the
design-it-twice can challenge it): **export from the engine's public
surface**, because the CLI already consumes both formatters today through
the engine's public `index.ts`. Hiding them inside the CLI would require
moving them across package boundaries, which is a wider scope than this
parent's deepening intent.
