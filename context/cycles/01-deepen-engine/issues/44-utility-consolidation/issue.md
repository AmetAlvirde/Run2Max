# Parent Issue #44 — Utility consolidation

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- **`addDays`**: exactly one definition exists in the workspace. Every
  current caller (`packages/engine/src/plan/{associate,build,reconcile,status}.ts`,
  `packages/cli/src/commands/{quantify,plan/status,plan/sync}.ts`) imports
  it. The 7 private copies are deleted. Verified by
  `grep -rn "function addDays" packages/` returning a single hit.
- **`clonePlan`**: exactly one definition exists in
  `packages/engine/src/plan/`. Both `plan/sync.ts` and `plan/adjust.ts`
  import it. The 2 private copies are deleted. Verified by
  `grep -rn "function clonePlan" packages/` returning a single hit. The
  helper is engine-internal; it is **not** added to `engine/index.ts`'s
  public surface unless a non-engine caller emerges (none today).
- **`transformKeys` / `snakeToCamel` / `camelToSnake`**: exactly one
  definition of each lives in the workspace. Both directions of the
  recursive key-walk live in the same module. The three current schema /
  emit sites (`packages/engine/src/plan/schema.ts`,
  `packages/engine/src/config/schema.ts`,
  `packages/cli/src/commands/plan/create.ts`) import from this module.
  Verified by `grep -rn "function snakeToCamel\|function camelToSnake\|function transformKeys" packages/` returning at most one hit per name.
- **`getDistance(record)`**: exactly one definition exists in
  `packages/engine/src/computations/`. The canonical signature is
  `(record: Run2MaxRecord) => number | null` — preserves the more honest
  type used by 3 of the 4 callers. `computations/km-splits.ts` updates
  its call sites to apply `?? 0` inline. The 4 private copies are
  deleted. Verified by `grep -rn "function getDistance" packages/`
  returning a single hit.
- The engine's public surface in `packages/engine/src/index.ts` exports
  `addDays` only if the CLI consumes it across the package boundary
  (which it does today — three CLI files use it). All other consolidated
  helpers (`clonePlan`, `snakeToCamel` / `camelToSnake` / their key-walk
  variants, `getDistance`) stay engine-internal unless a cross-package
  consumer exists. The index-rewrite parent (final cycle parent) owns
  final grouping; this parent only adds the line and lets that parent
  re-group.
- The CLI's `transformKeysToSnake` is replaced by the canonical
  camel-to-snake helper. If that helper is engine-internal,
  `packages/cli/src/commands/plan/create.ts` either imports it from a
  shared location *both* packages can reach, or keeps a CLI-thin wrapper
  that calls the engine helper. The pre-resolution preference is to
  expose the case helpers from engine if and only if the CLI is the only
  external consumer; otherwise keep the CLI's local helper but have it
  delegate to the engine's. The design-it-twice in sub-issue #45 settles
  this.
- All existing tests pass: `pnpm test` at the workspace root is green.
- The engine package builds (DTS included):
  `pnpm --filter @run2max/engine build` succeeds. This addresses the
  closure-flag carried forward from parent #38 (DTS-build can fail even
  when tests pass).
- TypeScript strict mode stays on. `TS2589` does not regress.
- CLI behaviour is byte-identical. `run2max plan status`,
  `run2max plan status --full`, `run2max plan adjust`,
  `run2max plan create`, `run2max plan sync`, and `run2max quantify`
  produce the same output as before for the same fixtures. Verified by
  running the existing CLI command tests without modification.
- No new domain term is introduced. `ubiquitous-language.md` is
  unchanged unless the design-it-twice surfaces a domain noun (it should
  not).
- Cycle PRD success metric #1 is satisfied: a single grep across
  `packages/` shows zero remaining duplicates of `flattenWeeks`,
  `clonePlan`, `addDays`, `transformKeys`, or `getDistance`.
  (`flattenWeeks` is already absent — verified at parent open.)

## Implementation approach

1. In sub-issue #45, design-it-twice each utility's canonical home and
   public-surface exposure. The four are independent design questions but
   share the same shape (one canonical home, every caller imports it).
   Record the chosen home and a one-sentence rejection rationale per
   utility. The sub-PRD records pre-resolution preferences; the
   design-it-twice may challenge them.
2. Move `addDays` to its chosen home. Bodies are byte-identical across
   all 7 sites; the move is mechanical. Update all 7 callers' imports.
   Delete the 7 private copies. Run grep to confirm exactly one
   definition remains.
3. Move `clonePlan` to its chosen home (engine-internal). Update both
   callers (`plan/sync.ts`, `plan/adjust.ts`). Delete the 2 private
   copies.
4. Move `snakeToCamel` and `camelToSnake` (and their `transformKeys` /
   `transformKeysToSnake` recursive wrappers) to their chosen home.
   Update the three schema/emit sites' imports. Delete the duplicates.
5. Move `getDistance` to its chosen home (likely
   `computations/utils.ts` since that file already holds shared
   record-helper math like `avg` / `rollingWindowPeak`, or a sibling
   `computations/record-helpers.ts` if `utils.ts` is reserved for
   numeric helpers — sub-issue #45 picks). Standardise on the
   `number | null` signature. Update km-splits' two call sites
   (`getDistance(records[i])` and `getDistance(records[i - 1])`) to
   apply `?? 0` inline. Delete the 4 private copies.
6. Update `packages/engine/src/index.ts` only if a consolidated helper
   needs to cross the package boundary. Today only `addDays` does
   (three CLI files import it). Add the export under the existing Plan
   schema/types/validation grouping (or wherever sub-issue #45
   determines it sits) — final grouping is the index-rewrite parent's
   call.
7. Run `pnpm test` at the workspace root and confirm green.
8. Run `pnpm --filter @run2max/engine build` and confirm the DTS build
   succeeds — closure-flag check carried forward from parent #38.
9. Run the grep checks listed under acceptance criteria. Each should
   return exactly one hit for each helper name (zero for the deleted
   `transformKeysToSnake` if it has been replaced by a wrapper, or one
   if a thin wrapper survives).
10. Record the verification in the parent close.

If during implementation any of the four moves uncovers a real design
fork — for example, if relocating `addDays` surfaces a debate over a
generic `lib/dates.ts` vs. a domain-co-located `plan/dates.ts`, or if
`getDistance`'s nullable reconciliation reveals a behaviour difference
not captured by existing tests — that decision is lifted into a sibling
sub-issue (`46-...`) rather than expanding sub-issue #45's scope.

## Dependencies

- Upstream: parent #32 (closed) — `Plan` is the input type for
  `clonePlan`. No re-opening.
- Upstream: parent #35 (closed) — eliminated `flattenWeeks`. This
  parent inherits the "zero duplicates" success-metric language but
  owns only the four remaining helpers.
- Upstream: parent #38 (closed) — `aggregateBucket` consumes the
  bucketing layer that uses `getDistance`. The bucketing layer is
  untouched; only the helper signature is reconciled.
- Upstream: parent #41 (closed) — `addDays` was kept private to
  `plan/status.ts` during the engine/presentation split with the
  explicit note that helper consolidation is this parent's scope.
- External: `valibot` untouched. `vitest` continues to drive tests.
- Tooling: `pnpm test` plus `pnpm --filter @run2max/engine build` for
  repository-runnable verification, and grep to verify uniqueness.

## Flags

- This parent does not consolidate `flattenWeeks`. Parent #35 already
  did. If a stray inline plan-flattening loop is discovered during
  implementation, that is a parent #35 regression and should be flagged
  separately.
- The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` on the final
  `index.ts` grouping stays open after this parent. This parent only
  adds whatever export lines its consolidation forces; the final
  ordering and section banners are the index-rewrite parent's call.
- If sub-issue #45's design-it-twice for `transformKeys` surfaces a
  cross-cutting decision (e.g. whether the engine should expose
  case-conversion utilities at all, given they are infrastructure not
  domain), `sdp-adr` runs at parent close. This is borderline — written
  only if the chosen direction carries non-obvious rationale.
- The engine deletion test (success signal from parent #41) does not
  apply here. Helper consolidation is purely additive-then-subtractive
  on the file graph; it does not introduce a deletable seam.
- Once this parent closes, re-introducing a private `addDays`,
  `clonePlan`, `transformKeys`, `snakeToCamel`, `camelToSnake`, or
  `getDistance` anywhere in the workspace is a drift signal — flag it
  in code review.
- Single sub-issue #45 is sized to deliver the full parent scope. If
  implementation reveals one of the four utility moves needs its own
  decision space (e.g. the case helpers raise a public/private
  question that splits the team), a sibling sub-issue is added under
  this parent rather than overloading #45.
