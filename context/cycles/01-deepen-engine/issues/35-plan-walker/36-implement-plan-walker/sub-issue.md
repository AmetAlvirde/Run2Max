# Sub-Issue #36 — Implement and adopt the Plan walker primitive

Vertical slice for parent issue #35. Delivers the full parent scope as a
single behaviour-preserving change: design the walker, implement it,
migrate every Plan-tree iteration call site in engine and CLI, and export
the walker under the engine's Periodization grouping.

## Description

Introduce a single Plan-walking primitive in `@run2max/engine`. Each
existing inline iteration of `plan → mesocycles → fractals → weeks` is
replaced by a call to the walker. The walker yields each Week annotated
with the surrounding Plan context already in use across call sites:
mesocycle name and 0-based index, fractal 0-based index and total fractals
in its mesocycle, week 0-based index inside the fractal, and absolute
1-based week index across the whole Plan.

The scope is a vertical slice — every concrete acceptance criterion of
parent #35 is closed by this sub-issue. If implementation reveals the
slice is too large (e.g. CLI migration uncovers an unexpected reshape),
it splits and a new sub-issue is added as a sibling. Today, only this
sub-issue is planned.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| TypeScript compiler | In-process | Test directly: type-check is part of `pnpm test`. |
| `vitest` | In-process | Existing engine and CLI test suites run as-is. |
| Plan-family interfaces (parent #32 output) | In-process | Test directly: walker input/output uses `Plan`, `Mesocycle`, `Fractal`, `Week` from `@run2max/engine`. |
| Existing Plan-tree call sites (engine + CLI) | In-process | Test directly: existing tests for `adjust`, `sync`, `status`, `validate`, `reconcile`, `quantify`, `plan sync` are the migration's regression net. |

No remote, collaborator-owned, or external dependencies. No port required —
no second adapter is in play. The walker is pure data transformation over
already-parsed Plans.

## Interface design

The interface this sub-issue must commit to is the walker's *return shape*
and *invocation form*. The runtime contract of every migrated call site
does not change.

### Design-it-twice

**Alternative A — Minimal surface: `walkPlan(plan): readonly WeekContext[]`**

A single function returning an eager readonly array of `WeekContext`
records. Iterable via `for..of`, indexable, supports all `Array` methods
(`findIndex`, `find`, `map`, `filter`, `slice`).

```ts
export interface WeekContext {
  absoluteIndex: number;        // 1-based across the whole Plan
  totalWeeks: number;           // length of the walked sequence
  mesocycleName: string;
  mesocycleIndex: number;       // 0-based within plan.mesocycles
  fractalIndex: number;         // 0-based within mesocycle.fractals
  totalFractals: number;        // length of mesocycle.fractals
  weekIndex: number;            // 0-based within fractal.weeks
  week: Week;                   // the named Week interface from parent #32
}

export function walkPlan(plan: Plan): readonly WeekContext[];
```

- Leverage: high — one symbol covers every observed call shape. `findIndex`
  for sync.ts frontier search, indexing for adjust.ts boundary work,
  iteration for validate.ts diagnostics, mapping for status.ts row
  building, and array spread for the test `flatMap` replacements all fall
  out of standard `Array` methods.
- Locality: high — the walker module is the single home of Plan-tree
  iteration. No second module to keep in sync.
- Testability: simple — a small focused unit test on a fixture plan
  validates the shape; every migrated call site's existing test is the
  end-to-end behaviour-preservation net.

**Alternative B — Optimised for common caller: small object with named reducers**

Export `walkPlan` plus three convenience reducers covering the call shapes
observed in the cycle PRD's listing:

```ts
export function walkPlan(plan: Plan): readonly WeekContext[];
export function mapWeeks<T>(plan: Plan, fn: (ctx: WeekContext) => T): T[];
export function findWeek(plan: Plan, predicate: (ctx: WeekContext) => boolean): WeekContext | undefined;
export function flattenWeeks(plan: Plan): readonly WeekContext[]; // alias for walkPlan
```

- Leverage: medium — the reducers are 1-line wrappers over `Array.prototype`
  methods. They restate what `Array` already provides, in a vocabulary that
  reads as Plan-native instead of array-native. Useful only if call sites
  read more clearly with the named reducer than with `walkPlan(plan).find(…)`.
- Locality: medium — same module as A, but the public surface is wider.
  Future maintainers must choose between four symbols where one would do.
- Testability: identical to A. The reducers add no new behaviour.

**Alternative C — Lazy iterator: `walkPlan(plan): Iterable<WeekContext>`**

A generator function. Callers use `for..of` directly; for array-method
shapes they spread (`[...walkPlan(plan)]`) or use a helper.

- Leverage: low — every existing call site needs array semantics
  (indexing, `findIndex`, `slice`). The lazy form forces a `[...]` spread
  tax at every site with no benefit: Plans are small (<50 weeks in
  practice), and no caller streams or short-circuits.
- Locality: identical to A.
- Testability: identical to A.

### Choice

**A (single eager array primitive).** Every observed call site already
builds an array of week-with-context records — the walker is the deeper
primitive of "compute this once, return the same shape everyone needs."
B's reducers restate `Array` methods in walker vocabulary without adding
information; the cycle's success metric ("a maintainer doing this does
not feel pulled to write a helper") is already satisfied because
`walkPlan(plan).findIndex(…)` is shorter than any alternative `findWeek`
call. C's lazy form imposes a spread tax across every call site to enable
streaming behaviour no caller uses.

B is rejected in one sentence: named reducers add a wider public surface
without information beyond what `Array.prototype` already provides at the
sizes a Plan ever takes.

C is rejected in one sentence: every observed caller needs array
semantics, so a generator return forces a uniform `[...]` spread tax to
recover behaviour the eager form gives directly.

This decision answers the cycle PRD's `MUST RESOLVE` open question on
iterator-vs-named-reducers; once parent #35 closes, update
`context/cycles/01-deepen-engine/prd.md` to reflect the resolution.

The choice is a candidate ADR per the cycle PRD; rationale captured here
is the seed for that ADR if one is written at parent close.

### Walker location

`packages/engine/src/plan/walk.ts` — a new module. The `WeekContext`
interface lives there (not in `plan/types.ts`) because it is an
iteration-output shape, not a parsed-data shape. Parent #32 deliberately
moved Plan-family types into `plan/types.ts`; mixing iteration-output
shapes back in dilutes the same boundary that parent stabilised.

Rejected: putting `WeekContext` in `plan/types.ts`. One sentence: the
named interfaces in `plan/types.ts` are the runtime/parser-output domain
types; `WeekContext` is a derived iteration shape and belongs with the
walker.

### Public interface

```ts
// packages/engine/src/plan/walk.ts
import type { Plan, Week } from "./types.js";

export interface WeekContext {
  absoluteIndex: number;
  totalWeeks: number;
  mesocycleName: string;
  mesocycleIndex: number;
  fractalIndex: number;
  totalFractals: number;
  weekIndex: number;
  week: Week;
}

export function walkPlan(plan: Plan): readonly WeekContext[];
```

Invariants:
- The returned array's length equals the total Week count across the Plan.
- `absoluteIndex` is 1-based and strictly increasing across the array.
- `mesocycleIndex`, `fractalIndex`, `weekIndex` are 0-based and consistent
  with the underlying `plan.mesocycles[mi].fractals[fi].weeks[wi]` triple.
- `totalWeeks` is identical for every entry — equal to the array length.
- `totalFractals` is the number of fractals in the entry's mesocycle.
- `week` is a structural reference into the input Plan; mutating it
  mutates the input. Callers that need immutable transforms must clone.
  (Existing `clonePlan` callers are unaffected — they clone their own copy
  before mutating.)

Error modes:
- `walkPlan` does not throw. A Plan with empty `mesocycles`, empty
  `fractals`, or empty `weeks` returns an empty array. (The schema
  enforces non-empty at parse time, so this is defensive — but the walker
  doesn't re-check.)

## Acceptance criteria

- `packages/engine/src/plan/walk.ts` exists and exports `WeekContext` and
  `walkPlan` as specified above.
- `packages/engine/src/index.ts` re-exports `WeekContext` and `walkPlan`
  under the existing Plan section.
- The two private `flattenWeeks` helpers in
  `packages/engine/src/plan/adjust.ts:56` and
  `packages/engine/src/plan/sync.ts:44` are deleted. Their callers consume
  `walkPlan` directly. Per-call-site fields not present on `WeekContext`
  (e.g. `executed`, `planned`, `start`, `note` in adjust.ts's `FlatWeek`)
  are read off `ctx.week` rather than re-projected into a private record.
- `packages/engine/src/plan/status.ts`, `plan/validate.ts`, and
  `plan/reconcile.ts` use `walkPlan` instead of nested loops. The
  `plan.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks))`
  chains in `plan/adjust.ts`, `plan/build.test.ts`,
  `plan/reconcile.test.ts`, and `plan/templates/builtin.test.ts` are
  replaced by `walkPlan(plan).map((c) => c.week)` (or the relevant
  context-aware projection).
- `packages/cli/src/commands/plan/sync.ts` and any other CLI Plan-tree
  iteration site uses `walkPlan` directly.
- `pnpm test` succeeds at the workspace root with no test modifications
  beyond mechanical replacements of inline iteration with `walkPlan`. No
  test asserts on a behavioural change introduced by the walker.
- Output of `quantify`, `plan status`, `plan adjust`, `plan sync`, and
  `plan validate` for existing fixtures is byte-identical to pre-walker
  output. Verified by running each command against its fixture and
  diffing.
- Grep for `flattenWeeks` outside `plan/walk.ts` returns nothing. Grep
  for `for.*plan\.mesocycles` and `mesocycles\.flatMap` outside test
  files and `plan/walk.ts` returns nothing in `packages/engine/src/` and
  `packages/cli/src/`.
- TypeScript strict mode stays on. `TS2589` is not emitted at any point
  during the change.

## Proposed tests

1. **Walker unit test (new)** — `packages/engine/src/plan/walk.test.ts`.
   Construct a small fixture Plan with two mesocycles, varied fractal
   counts, and varied week counts. Assert:
   - The walker returns an array of the correct total length.
   - `absoluteIndex` is 1, 2, 3, ... in order.
   - For a sample week, `mesocycleName`, `mesocycleIndex`, `fractalIndex`,
     `totalFractals`, `weekIndex`, and `week` reference the expected
     positions.
   - Empty `mesocycles` (constructed in-test, bypassing the schema) yields
     an empty array.
2. **Existing engine tests pass unchanged.** `adjust`, `sync`, `status`,
   `validate`, `reconcile`, `build`, and `templates/builtin` test files
   continue to pass. Where they currently re-implement `flatMap` chains
   to flatten the Plan tree, those chains are replaced by
   `walkPlan(...).map(c => c.week)`. The rest of each test stays the
   same.
3. **Existing CLI tests pass unchanged.** Any CLI test exercising
   `plan/sync` or `quantify` with a `--plan` argument or auto-discovered
   `plan.yaml` continues to pass without modification.
4. **Fixture byte-identity check.** Run `quantify` and each `plan`
   subcommand against their existing fixtures pre-change and post-change;
   diffs must be empty. (Manual verification step rather than a new
   automated test — the engine has no end-to-end byte-diff harness today,
   and adding one is out of scope per the cycle PRD's non-goals.)
5. **No new behavioural test is added.** This sub-issue is a refactor;
   new behaviour would be scope drift. If during implementation a gap in
   existing test coverage is discovered, record the gap as a flag on
   parent #35 rather than expanding this sub-issue.

## Affected artifacts

- `packages/engine/src/plan/walk.ts` — **new file**, holds `WeekContext`
  and `walkPlan`.
- `packages/engine/src/plan/walk.test.ts` — **new file**, walker unit
  tests.
- `packages/engine/src/plan/adjust.ts` — delete the private `flattenWeeks`
  (lines 56–81) and its `FlatWeek` interface (lines 41–50). Replace
  callers with `walkPlan`. Replace the
  `mergedPlan.mesocycles.flatMap(...)` chain (lines 270–271, 278) with a
  walker call.
- `packages/engine/src/plan/sync.ts` — delete the private `flattenWeeks`
  (lines 44–65) and its `FlatWeek` interface (lines 36–42). Replace
  callers with `walkPlan`.
- `packages/engine/src/plan/status.ts` — replace the manual three-level
  loop (lines 98–116) building `RawEntry[]` with a `walkPlan(...).map(...)`
  call. The `RawEntry` shape is replaced by inline use of `WeekContext`'s
  fields plus `executed`/`reason` read off `ctx.week`.
- `packages/engine/src/plan/validate.ts` — replace the nested
  `forEach(meso => forEach(fractal => forEach(week)))` (lines 16–80) with
  a single `walkPlan(plan).forEach(...)` loop. The `findPrecedingTa`
  helper continues to operate on the fractal's weeks directly; no change
  needed there beyond receiving the fractal weeks via `walkPlan`'s
  context.
- `packages/engine/src/plan/reconcile.ts` — migrate any nested loop or
  `flatMap` chain to `walkPlan`. (Inspect during implementation; the cycle
  PRD lists reconcile as a Plan-walker call site.)
- `packages/engine/src/plan/build.test.ts`,
  `packages/engine/src/plan/reconcile.test.ts`,
  `packages/engine/src/plan/templates/builtin.test.ts`,
  `packages/engine/src/plan/adjust.test.ts` — replace
  `plan.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks))`
  (and equivalents) with `walkPlan(plan).map(c => c.week)`.
- `packages/engine/src/index.ts` — re-export `WeekContext` and `walkPlan`
  from `plan/walk.js` under the Plan section.
- `packages/cli/src/commands/plan/sync.ts` — migrate the inline
  `mesocycles.map(...)` walking pattern at lines 37–39 onwards if it is
  a true Plan-tree walk (versus an immutable clone, which is helper
  consolidation territory in a later parent). If the pattern is a clone
  rather than a walk, leave it for the helper-consolidation parent.
- `packages/cli/src/commands/quantify.ts` — only migrate sites that walk
  the Plan tree. The `Plan` import is already direct (parent #32). No
  re-introduction of `PlanLike` or any structural shadow.

## Dependencies

- Upstream sub-issues: parent #32 / sub-issue #33 (closed). Walker input
  type `Plan` and yielded `Week` come from `plan/types.ts`.
- External services: none.
- Test fixtures: existing engine and CLI fixtures are reused unchanged.
  The walker unit test introduces a small in-test Plan fixture rather
  than a new yaml file.
