# Cycle 01 — Deepen the Engine

> High-level PRD for the foundation refactor cycle. No new user-facing
> features. Sub-PRDs and parent issues will live in this cycle's folder
> alongside this document.

## Focus

Deepen `@run2max/engine` into a small, leverageable core by collapsing the
already-discovered shallow seams: Plan walking, split aggregation,
engine/presentation separation, and the inferred-type chain that produced the
documented `TS2589` workaround. The CLI shrinks to a thin shell on top.

## Intentions

- Move the codebase from "correct but shallow" to "correct and deep" — each
  domain concept lives in one place with a clear interface.
- Make the next feature cycle a feature cycle, not a four-file integration
  cycle.
- Keep behavior identical at the user-facing surface (CLI output, plan files,
  config files) so the cycle is a pure refactor.
- Let domain language drive module shape: the names in
  `ubiquitous-language.md` should map to real seams in code.

## Goals

- A single Plan-walking primitive (or small set of primitives) consumed by
  every site that currently re-flattens the Plan tree inline.
- A single split-aggregation primitive parameterized by bucketing strategy,
  consumed by segments, km-splits, and dynamics summaries — eliminating the
  three near-identical row builders.
- Plan / Mesocycle / Fractal / Week / TestingPeriod expressed as plain named
  TypeScript interfaces in `plan/schema.ts`, with valibot used for parsing
  only — no public type derived from `v.InferOutput`.
- The CLI's `PlanLike` structural-subtype workaround and its accompanying
  comment block are deleted; `Plan` imports work directly without `TS2589`.
- Plan presentation (`formatDefaultView`, `formatFullView`) lives under
  `formatters/`, not inside `plan/status.ts`. Engine logic and presentation
  do not import each other.
- One canonical home for `addDays`, `clonePlan`, `transformKeys`, and
  `getDistance(record)`. No duplicates across plan, config, or computation
  modules.
- Engine public API surface is reduced and re-grouped by domain concept;
  removed exports are either folded into deeper APIs or genuinely internal.
- Tests in `plan/status.test.ts` (and any sibling tests asserting on rendered
  strings) reassert against structural status data, not formatted output.
  Formatting gets its own thin tests.

## Non-goals

- No new user-facing features. No new CLI commands, no new `plan.yaml`
  fields, no new metrics, no new output sections.
- No change to the on-disk format of `plan.yaml`, `~/.config/run2max/config.yaml`,
  or AnalysisResult JSON/YAML output. Renames inside the YAML schema are out
  of scope.
- No swap of valibot for another validation library. The fix is to stop
  exposing inferred types publicly, not to replace the parser.
- No rewrite of the FIT-parsing layer or the weather adapter. Those modules
  are deep enough already.
- No performance work. Speed is not the motivating friction; leverage is.
- No introduction of speculative abstractions for features not in the
  glossary. Every new module name must map to a term in
  `ubiquitous-language.md` or be obviously infrastructural.
- No cross-cycle scope creep: anomaly detection, sync, adjust, and reconcile
  may be touched only insofar as they consume the new seams. Their behavior
  does not change.

## User stories

- As a maintainer adding a feature that walks the Plan tree, I import one
  walker primitive and receive each Week with mesocycle / fractal context
  attached, so I do not write the fifth `flattenWeeks`.
- As a maintainer changing how a tier-aware metric is rolled up across a
  Run, I edit the single split-aggregation primitive once and segments,
  km-splits, and dynamics all benefit, so I do not edit three near-identical
  row builders.
- As a maintainer importing `Plan` from the engine in a new module, I get a
  plain named interface and TypeScript does not error with `TS2589`, so I do
  not need to invent a `PlanLike` shadow type.
- As a maintainer changing how a Plan status is rendered, I edit a formatter
  module without touching `getPlanStatus`, so I cannot accidentally change
  the computed status while editing presentation.
- As a maintainer reading the engine's public exports, I see fewer names
  grouped by domain concept, so I can find the seam I need without scanning
  fifty exports.
- As a maintainer running the test suite after a behavior-preserving Plan
  refactor, the tests pass without my having to update string assertions
  that check rendered output, so refactoring is not gated on snapshot
  rewriting.

## Encounter statements

- A maintainer opening `packages/engine/src/index.ts` first encounters a
  shorter, domain-grouped export list whose top-level groupings match
  `ubiquitous-language.md` (Periodization, Runs and capture, Metrics and
  zones, Analysis output).
- A maintainer opening `packages/cli/src/commands/quantify.ts` first
  encounters direct imports from `@run2max/engine` with no `PlanLike`
  workaround and no fourteen-line comment about `TS2589`.
- A maintainer opening `packages/engine/src/plan/status.ts` first encounters
  pure status computation; rendering is somewhere under `formatters/`.

## Constraints and assumptions

- TypeScript strict mode stays on. `TS2589` must not regress.
- The full test suite must stay green at every parent-issue closure, not
  only at cycle close.
- Behavior is preserved end-to-end: `quantify` output and `plan` command
  output for the existing fixtures must be byte-identical (or at most differ
  only in whitespace explicitly approved during decomposition).
- Public engine exports may be removed or renamed as part of the deepening,
  but every removal must be justified by either folding into a deeper API or
  being genuinely internal — not by silent deletion.
- `valibot` stays as the runtime parser. Its inferred types stop being the
  public type of `Plan` and friends.
- The four candidates may be sequenced into multiple parent issues during
  decomposition. They share one cycle, but they need not share one PR.
- Foundation parent issues land first (Plan walker + named interfaces),
  because every later parent issue consumes their interfaces. Once a
  foundation parent issue's AAR is closed, its interfaces are stable for the
  rest of the cycle; re-opening a closed AAR is a drift signal.
- The work happens on `refactor/foundation` and merges to `main` only at
  cycle close, not per parent issue.

## Success metrics

- Zero call sites duplicating `flattenWeeks`, `clonePlan`, `addDays`,
  `transformKeys`, or `getDistance` after the cycle. Verified by grep.
- Zero occurrences of `v.InferOutput` for `Plan`, `Mesocycle`, `Fractal`,
  `Week`, `TestingPeriod` in publicly exported types. Verified by grep.
- Zero occurrences of `PlanLike` or equivalent structural-subtype workarounds
  for engine types in CLI or engine code.
- The `TS2589` comment block in `cli/src/commands/quantify.ts` is removed,
  and repository-runnable verification commands (currently `pnpm test`) pass
  without reintroducing the workaround.
- The three current row-builder paths (segments, km-splits, dynamics) reach
  one shared primitive with bucketing as the only varying dimension.
  Measured by line-count reduction and by inspection of import graph.
- `plan/status.ts` exports no formatter; formatters live under
  `formatters/`. Verified by import graph: `plan/` does not depend on
  `formatters/`, and `formatters/` depends on `plan/` only through the
  status data type.
- Engine public-export count drops meaningfully (target: ≤30, from 50+),
  and every remaining export maps to a glossary term or an obvious
  infrastructure concern.
- Test suite passes at every parent-issue close. No test asserts on rendered
  Plan-status strings after the cycle (other than tests dedicated to the
  formatters themselves).

## Success signals

- A new feature that needs to walk the Plan can be added by importing one
  symbol — a maintainer doing this does not feel pulled to write a helper.
- A grilling session on a new sub-PRD references named modules that match
  glossary terms one-to-one without qualifier translation.
- Adding a new split-aggregated metric (hypothetically) takes editing one
  file, and the same change shows up in segments, km-splits, and dynamics
  consistently without further work.
- The CLI's `quantify.ts` reads as a thin orchestrator with no inline plan
  walking and no inline date math.
- A future maintainer can delete `formatters/plan.ts` and the engine still
  type-checks and tests still pass for the logic layer (deletion test for
  the engine/presentation seam).

## Open questions

- `RESOLVED IN IMPLEMENTATION`: The Plan walker is exposed as a single eager
  array primitive, `walkPlan(plan): readonly WeekContext[]`, not a named
  reducer set. This was decided in parent issue #35 (sub-issue #36) via
  design-it-twice and captured in ADR 0001.
- `RESOLVED IN IMPLEMENTATION`: Named `Plan` / `Mesocycle` / `Fractal` /
  `Week` / `TestingPeriod` interfaces live in `plan/types.ts` (parent issue
  #32), and `parsePlan` in `plan/schema.ts` returns the named `Plan`. This
  removed the public inferred-type chain while keeping schema/runtime
  validation in `schema.ts`.
- `MUST RESOLVE`: What is the shape of the unified split-aggregator
  parameter — a `bucketBy` strategy function returning bucket keys, or a
  pre-bucketed `Slice[]` input the aggregator just reduces over? Affects
  whether segments and km-splits share more than just row construction.
  Decided in the split-aggregator sub-PRD.
- `RESOLVE THROUGH IMPLEMENTATION`: Final shape of the engine's public
  export grouping. Target shape will emerge as parent issues land; the
  `index.ts` is rewritten last, once all internal seams settle.
- `RESOLVE THROUGH IMPLEMENTATION`: Whether `formatters/plan.ts` re-exports
  a small public formatting API or stays CLI-internal. Depends on whether a
  second access surface (web, etc.) materializes during the cycle — if not,
  it stays CLI-internal.
- `RESOLVE THROUGH IMPLEMENTATION`: Whether the cycle produces an ADR for
  "valibot inferred types are not public types." Likely yes, but written
  only after the named-interfaces parent issue closes so the ADR records a
  real decision, not a hypothetical one.
