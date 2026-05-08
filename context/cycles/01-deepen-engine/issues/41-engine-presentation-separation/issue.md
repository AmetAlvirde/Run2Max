# Parent Issue #41 — Engine/presentation separation

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- `packages/engine/src/plan/status.ts` exports `getPlanStatus` and the
  status data types (`PlanStatus`, `WeekStatusEntry`, `NextMilestone`,
  `WeekMarker`, `PlanStatusOptions`) only. It does not export
  `formatDefaultView` or `formatFullView`. It does not import from
  `packages/engine/src/formatters/`.
- `packages/engine/src/formatters/plan.ts` exists and exports
  `formatDefaultView(status: PlanStatus): string` and
  `formatFullView(status: PlanStatus): string` with the exact same
  rendering behaviour as today. The private helpers `buildHeader`,
  `relativeLabel`, and `weekToFullToken` move with the formatters into
  this module (or remain private to it). No rendering helper stays in
  `plan/status.ts`.
- The engine's public surface (`packages/engine/src/index.ts`) continues
  to export `formatDefaultView` and `formatFullView`, but re-exports
  them from `./formatters/plan.js` rather than `./plan/status.js`. The
  status computation (`getPlanStatus`) and status data types stay
  exported from `./plan/status.js`.
- `packages/engine/src/plan/status.test.ts` asserts only on the
  structural `PlanStatus` shape: marker classification, milestone
  computation, unsynced-past grouping, deviation-report enrichment,
  completeness, current-week selection, week-end boundary semantics. It
  does not assert on any rendered string.
- `packages/engine/src/formatters/plan.test.ts` is **new** and holds the
  rendering tests that moved. Each test builds a `PlanStatus` (either
  directly or via `getPlanStatus` against a parsed plan fixture) and
  asserts on the resulting `formatDefaultView` / `formatFullView`
  output. The set of input scenarios tested is the union of today's
  rendering cases — no rendering scenario is dropped.
- `packages/cli/src/commands/plan/status.ts` and
  `packages/cli/src/commands/plan/adjust.ts` continue to function
  without source changes beyond what the engine's public surface
  forces. If `formatDefaultView` and `formatFullView` remain on the
  same import path (`@run2max/engine`), the CLI files do not change at
  all. If the public surface relocates them to a new exported namespace
  during this parent, both CLI files update their imports accordingly
  and nothing else.
- CLI behaviour is byte-identical. `run2max plan status` and
  `run2max plan status --full` produce the same output as before for
  the same plan fixtures. `run2max plan adjust` produces the same
  preview output. Verified by running the existing CLI command tests
  (`packages/cli/test/commands/plan/status.test.ts`,
  `packages/cli/test/commands/plan/adjust.test.ts`) without
  modification.
- All existing tests pass: `pnpm test` at the workspace root is green.
  The engine package builds (including DTS) — `pnpm --filter @run2max/engine build` succeeds, addressing the closure-flag carried
  forward from parent #38 (DTS-build can fail even when tests pass).
- TypeScript strict mode stays on. `TS2589` does not regress.
- The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` open question on
  whether `formatters/plan.ts` re-exports a public formatting API or
  stays CLI-internal is answered in sub-issue #42's design-it-twice
  with a one-sentence rejection rationale for the alternative.
- Engine deletion test (cycle PRD success signal): deleting
  `packages/engine/src/formatters/plan.ts` leaves the logic layer
  type-checking. Verified by inspection of the import graph
  (`plan/status.ts` does not import from `formatters/plan.ts`; nothing
  in `plan/` does); `pnpm --filter @run2max/engine build` succeeds with
  the formatter module deleted *if its public re-exports in `index.ts`
  are also deleted*. The deletion test is a property of the seam, not
  a test the suite runs — it is verified manually and recorded in the
  parent close.

## Implementation approach

1. In sub-issue #42, design-it-twice the formatter's location and
   public surface. At minimum compare:
   - Alternative A — **`formatters/plan.ts`, re-exported from
     `engine/index.ts`**: formatters live in the engine's `formatters/`
     directory next to the existing `formatters/index.ts` (which holds
     `formatResult`, ASCII chart, JSON / YAML / Markdown writers for
     `AnalysisResult`). Engine continues to expose `formatDefaultView`
     and `formatFullView` on the public surface; the CLI imports them
     unchanged. The formatters consume `PlanStatus` from
     `plan/status.ts` and import nothing else from `plan/`.
   - Alternative B — **`packages/cli/src/commands/plan/format.ts`,
     CLI-only**: formatters live in the CLI package, the engine's
     public surface drops `formatDefaultView` / `formatFullView`, and
     `packages/cli/src/commands/plan/status.ts` and `adjust.ts` import
     directly from `./format.js`. No second consumer exists today.
   Record the chosen design and a one-sentence rejection rationale for
   the other. The sub-PRD records a pre-resolution preference for A;
   the design-it-twice must reach its own decision rather than ratify
   the preference.
2. Move `formatDefaultView`, `formatFullView`, `buildHeader`,
   `relativeLabel`, and `weekToFullToken` from `plan/status.ts` into
   the chosen formatter module. Their bodies do not change beyond the
   import-path adjustments. `PlanStatus`, `WeekStatusEntry`,
   `NextMilestone`, `WeekMarker`, `PlanStatusOptions`, `getPlanStatus`,
   and the private `addDays` helper used by `getPlanStatus` stay in
   `plan/status.ts`.
3. Update `packages/engine/src/plan/status.ts` to remove the formatter
   exports and the formatter helpers; trim its `Helpers` and
   `Default view` / `Full view` section banners. The file now holds
   only the status data types, `getPlanStatus`, and its private date
   helper.
4. Update `packages/engine/src/index.ts`. Under the existing Plan
   schema/types/validation grouping, the line `export {
   getPlanStatus, formatDefaultView, formatFullView } from
   "./plan/status.js"` becomes `export { getPlanStatus } from
   "./plan/status.js"` (the exported types on the next line stay).
   Under the existing Formatters grouping (or a new one if Alternative
   A surfaces it as a distinct sub-grouping during sub-issue interface
   design — the index-rewrite parent owns final grouping), add `export
   { formatDefaultView, formatFullView } from "./formatters/plan.js"`.
5. Split `packages/engine/src/plan/status.test.ts`. Identify each
   `describe`/`it` block:
   - Status-shape tests (marker classification, milestone selection,
     unsynced grouping, deviation enrichment, completeness, week-end
     boundaries) **stay**. Where they currently call
     `formatDefaultView` / `formatFullView` to read a derived string,
     they switch to inspecting the `PlanStatus` directly.
   - Rendering tests (asserting on the output of the formatters)
     **move** to a new `packages/engine/src/formatters/plan.test.ts`.
     Each moved test imports the formatter from the new location and
     reuses the same plan fixture/builder helpers (e.g.
     `makeFullPlan`, `makeSingleFractalPlan`) — copy or relocate those
     helpers to a shared test-fixture module if both files need them.
6. Verify CLI imports. If both formatters remain re-exported from the
   engine's `index.ts` (Alternative A), the CLI files do not change.
   If they relocate to a different namespace, update
   `packages/cli/src/commands/plan/status.ts:7-8` and
   `packages/cli/src/commands/plan/adjust.ts:10` accordingly.
7. Run `pnpm test` at the workspace root and confirm green.
8. Run `pnpm --filter @run2max/engine build` and confirm the engine's
   DTS build succeeds — this is the closure-flag check carried forward
   from parent #38.
9. Verify the deletion test by inspection: confirm
   `packages/engine/src/plan/` contains zero imports of
   `formatters/plan.js` and zero imports of any rendering helper.
   Record the verification in the parent close.

If during implementation the move decomposes into more than one
vertical slice (e.g. a separate sub-issue to relocate the test fixture
helpers if they grow non-trivially), additional sub-issues are added
as siblings to #42.

## Dependencies

- Upstream: parent #32 (closed) — named Plan-family interfaces are
  consumed by `getPlanStatus` and by the formatters (via `PlanStatus`,
  which references `Plan` indirectly). No re-opening.
- Upstream: parent #35 (closed) — `walkPlan` is consumed by
  `getPlanStatus`. The walker surface stays unchanged.
- Upstream: parent #38 (closed) — unrelated to plan status; mentioned
  only because its closure flag (DTS-build verification) carries
  forward to this parent's verification step.
- External: `valibot` untouched. `vitest` continues to drive tests.
- Tooling: `pnpm test` plus `pnpm --filter @run2max/engine build`
  for repository-runnable verification.

## Flags

- Once this parent closes, the engine/presentation seam is stable for
  the rest of the cycle. Re-introducing a rendering helper inside
  `plan/` in a downstream parent is a drift signal — flag it.
- This parent does not consolidate `addDays`. The helper currently
  appears in 6 places (see cycle PRD success metric #1); resolving
  that is the helper-consolidation parent's scope. The
  presentation-split parent may relocate the local `plan/status.ts`
  copy if the separation surfaces a natural boundary, but does not
  consolidate across modules.
- The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` on
  `formatters/plan.ts` (public formatting API vs CLI-internal) is
  answered here. After parent close, update
  `context/cycles/01-deepen-engine/prd.md` to mark it resolved with
  the chosen shape.
- The cycle PRD's success signal "a future maintainer can delete
  `formatters/plan.ts` and the engine still type-checks" is verified
  by inspection at parent close, not by running a deletion build. If
  the seam can't pass that inspection (e.g. a leaked import surfaces
  during sub-issue close), reopen and tighten before parent close.
- If during implementation a rendering test reveals a behaviour that
  is *not* covered by the existing `PlanStatus` shape (e.g. a
  formatter computes something that should be a `PlanStatus` field),
  that is scope creep into status-shape redesign. Flag it as a
  follow-up rather than expanding this parent.
- If the design-it-twice decision merits an ADR (per cycle-PRD policy:
  hard to reverse, surprising without context, and the result of a
  real trade-off), `sdp-adr` runs at parent close. The
  CLI-internal-vs-engine-public placement is borderline — written
  only if the chosen direction carries non-obvious rationale.
- The single sub-issue #42 is sized to deliver the full parent scope.
  If implementation reveals the slice is too large (e.g. test
  splitting uncovers a fixture-builder ownership question that needs
  its own decision), a sibling sub-issue #43 is added under this
  parent.
