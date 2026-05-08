# Sub-Issue #45 — Implement utility consolidation

## Description

Consolidate the four duplicated helpers identified by parent #44 into one
canonical home each, point every caller at the canonical home, and delete
the duplicates. Reconcile `getDistance`'s return type to one honest
signature.

The four moves are mechanically similar but each has a small homing
decision. This sub-issue is one vertical slice: one PR, one review window,
one verification pass. If during implementation a homing decision turns
out to be contentious enough to warrant its own decision space, lift it
into a sibling sub-issue (`46-...`) rather than overloading this one.

## Dependency classification

All four utilities are **in-process** dependencies — pure TypeScript
functions with no I/O, no external services, no runtime configuration.
They are tested directly through the interface (the consumers' existing
unit tests already cover their behaviour).

No port/adapter is justified. No mock is needed. The only verification
surfaces are:

- `pnpm test` at the workspace root — proves behaviour preservation.
- `pnpm --filter @run2max/engine build` — proves the DTS build still
  succeeds (closure-flag from parent #38).
- `grep` — proves uniqueness per helper name.

## Interface design

### `addDays(dateStr: string, days: number): string`

Pure UTC ISO-date math. Body is byte-identical across all 7 sites:

```typescript
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
```

**Design-it-twice.**

- **Alternative A — `packages/engine/src/plan/dates.ts`, exported from
  engine's public surface.** Co-located with the only domain that uses
  it (every current caller is plan-week math: building, syncing,
  reconciling, statusing, associating, or quantify-time week-end
  computation). Engine's public `index.ts` re-exports it so the three
  CLI callers can import from `@run2max/engine`.
- **Alternative B — `packages/engine/src/lib/dates.ts`, generic
  infrastructure.** A new `lib/` directory for non-domain utilities.
  Same export shape on the public surface, but the file lives outside
  any domain folder.

**Chosen: A.** Co-location matches the cycle PRD's stance that "domain
language drives module shape" — `addDays` has no consumer outside plan
date math today, so spinning up a `lib/` directory for one helper is
speculative infrastructure. If a non-plan caller later needs ISO date
math, the helper relocates then. **Rejection of B**: introduces a new
top-level directory for a single function; over-organises before
demand.

The helper is added to the engine's public surface because three CLI
files consume it across the package boundary. Final grouping in
`index.ts` is the index-rewrite parent's call; this sub-issue adds the
line under the existing Plan schema/types grouping.

### `clonePlan(plan: Plan): Plan`

Three-level nested spread. Body is byte-identical across both sites.

**Design-it-twice.**

- **Alternative A — `packages/engine/src/plan/clone.ts`, engine-internal.**
  A small new file beside `plan/sync.ts` and `plan/adjust.ts`. Not
  exported from `engine/index.ts` because no cross-package caller
  exists.
- **Alternative B — folded into `packages/engine/src/plan/types.ts`** as
  a co-located helper next to the `Plan` interface. Saves one file but
  mixes data definition with operation.

**Chosen: A.** A small dedicated file keeps `plan/types.ts` purely
declarative (parent #32's encounter statement: maintainers opening
types files first encounter named interfaces, not operations). One
extra file is cheap; type-file purity is valuable. **Rejection of B**:
muddles the type module's encounter shape.

### Case-transform helpers

Two private functions repeated:

```typescript
function snakeToCamel(str: string): string { /* /(_[a-z])/ → uppercase */ }
function transformKeys(value: unknown): unknown { /* recursive walk */ }
```

The CLI's `plan/create.ts` has the **inverse direction** —
`camelToSnake` + `transformKeysToSnake` — used to emit YAML with
snake_case keys. Bodies are mirror-symmetric.

**Design-it-twice.**

- **Alternative A — `packages/engine/src/plan/case-keys.ts`,
  bidirectional, exported.** One module exports `snakeToCamel`,
  `camelToSnake`, `transformKeysSnakeToCamel`,
  `transformKeysCamelToSnake`. Both engine schema files import the
  forward direction; the CLI's `plan/create.ts` imports the inverse.
  Engine's public surface adds the four helpers (or the two
  high-level `transformKeys*` functions only — implementation
  detail).
- **Alternative B — engine keeps an internal `case-keys.ts` (forward
  only), CLI keeps its own private `camelToSnake` + wrapper.** No
  cross-package coupling; the CLI's emit-side stays self-contained.
  Eliminates the engine→CLI duplication of the forward direction
  and the engine-side duplication between `plan/schema.ts` and
  `config/schema.ts`, but leaves the CLI's inverse helper as a
  separate single copy.

**Chosen: A.** The two directions are symmetric mirrors of each
other — keeping them in one module makes that symmetry visible and
prevents future drift (e.g. one direction handles arrays correctly
while the other doesn't). Exposing the helpers across the package
boundary is a small public-surface cost; the alternative is keeping
two near-identical case-transform modules in two packages, which is
exactly the duplication this parent eliminates. **Rejection of B**:
preserves a CLI-side copy of mirror-symmetric logic; future drift
between the two directions is exactly the kind of bug this
consolidation should prevent.

The case helpers are infrastructure, not domain. Final placement in
`engine/index.ts`'s grouping (under a possible "Infrastructure" or
"Internal utilities" section) is the index-rewrite parent's call.
This sub-issue adds the export lines; that parent groups them.

### `getDistance(record: Run2MaxRecord): number | null`

Reads `strydDistance` falling back to `distance`. Three callers
(`segments`, `elevation`, `summary`) declare the return type as
`number | null` and handle null at the call site. The fourth
(`km-splits`) declares `number` and inlines `?? 0` in the helper
itself.

**Design-it-twice.**

- **Alternative A — canonical signature is `number | null`,
  km-splits inlines `?? 0` at its call sites.** Preserves the more
  honest type; matches 3 of the 4 existing callers; lets each caller
  decide whether null means "missing data" or "treat as zero".
- **Alternative B — canonical signature is `number`, helper applies
  `?? 0` internally.** Simpler at call sites but loses the
  null-vs-zero distinction. Segments would need a separate
  null-detection helper for its `distances.map(getDistance)` use
  case (line 78 of `segments.ts`), which currently relies on the
  `null` value to detect missing-distance records.

**Chosen: A.** Forcing the signature to `number` would silently
convert "no recorded distance" into "distance is zero metres" for
the three callers that currently distinguish them. That is a
behaviour change disguised as a refactor. The `?? 0` at km-splits'
two call sites (lines 34–35 of `km-splits.ts`) is a one-line edit
per site. **Rejection of B**: trades one inlined coalescer for
silent null-coercion in three downstream computations.

Home: extend `packages/engine/src/computations/utils.ts` with
`getDistance`. That file already holds shared record-helper math
(`avg`, `rollingWindowPeak`). No new file needed.

## Acceptance criteria

- `grep -rn "function addDays" packages/` returns exactly one hit.
- `grep -rn "function clonePlan" packages/` returns exactly one hit.
- `grep -rn "function snakeToCamel\|function camelToSnake" packages/`
  returns at most one hit per name (one if the helpers are factored
  out separately, zero if they live only as inline arrow expressions
  inside `transformKeysSnakeToCamel` / `transformKeysCamelToSnake`).
- `grep -rn "function transformKeys" packages/` returns at most two
  hits — one for the snake-to-camel walker, one for the inverse —
  both in the same module.
- `grep -rn "function getDistance" packages/` returns exactly one hit
  in `packages/engine/src/computations/utils.ts`.
- All 7 `addDays` callers import from
  `@run2max/engine` (CLI sites) or `./dates.js` / `./plan/dates.js`
  (engine sites, depending on file location).
- Both `clonePlan` callers import from `./clone.js`.
- The three case-transform consumer sites (`plan/schema.ts`,
  `config/schema.ts`, `cli/commands/plan/create.ts`) import from the
  consolidated module.
- The four `getDistance` consumer sites (`segments`, `km-splits`,
  `elevation`, `summary`) import from `./utils.js` (relative within
  `computations/`).
- `km-splits.ts` lines 34–35 are updated to apply `?? 0` at the call
  site, restoring the original `number` semantics that file relies
  on.
- `pnpm test` at the workspace root: green.
- `pnpm --filter @run2max/engine build`: green (DTS build included).
- `engine/index.ts` adds at most these public exports:
  `addDays` (cross-package consumer in CLI), and the case-transform
  helpers (cross-package consumer in CLI's `plan/create.ts`).
  `clonePlan` and `getDistance` are not added to the public surface.
- TypeScript strict mode stays on. No `TS2589`.
- CLI behaviour is byte-identical against existing fixtures.

## Proposed tests

No new tests are written. The four utilities are pure helpers covered
indirectly by the existing test suites for their consumers:

- `addDays` is exercised by the plan-walking tests, the build/sync/
  reconcile/status/associate test suites, and the CLI command tests
  for `plan status`, `plan sync`, and `quantify`. If any current
  caller's tests pass after the move, the helper move is correct.
- `clonePlan` is exercised by `plan/sync.test.ts` and
  `plan/adjust.test.ts` (immutability assertions). Both must pass
  unmodified.
- The case-transform helpers are exercised by every plan-fixture and
  config-fixture test that round-trips snake_case YAML through
  validation. The CLI's `plan/create.test.ts` exercises the inverse
  direction.
- `getDistance` is exercised by `computations/segments.test.ts`,
  `km-splits.test.ts`, `elevation.test.ts`, and `summary.test.ts`.
  The km-splits `?? 0` inlining is verified by km-splits' existing
  expected-output fixtures.

If the test suite passes and the grep checks return the expected
counts, the consolidation is verified. Adding new tests for these
helpers in isolation would test the test, not the system.

## Affected artifacts

**Created**:

- `packages/engine/src/plan/dates.ts` (or `lib/dates.ts` per
  design-it-twice — A chose `plan/dates.ts`).
- `packages/engine/src/plan/clone.ts`.
- `packages/engine/src/plan/case-keys.ts` (or `lib/case-keys.ts` —
  A chose `plan/case-keys.ts` for symmetry with the `dates.ts`
  decision; the engine-side schemas that consume it both live under
  `plan/`-adjacent territory, and `config/schema.ts` already imports
  from `plan/`-adjacent files).

**Modified**:

- `packages/engine/src/plan/associate.ts` — drop private `addDays`,
  import from `./dates.js`.
- `packages/engine/src/plan/build.ts` — drop private `addDays`,
  import from `./dates.js`.
- `packages/engine/src/plan/reconcile.ts` — drop private `addDays`,
  import from `./dates.js`.
- `packages/engine/src/plan/status.ts` — drop private `addDays`,
  import from `./dates.js`.
- `packages/engine/src/plan/sync.ts` — drop private `clonePlan`,
  import from `./clone.js`.
- `packages/engine/src/plan/adjust.ts` — drop private `clonePlan`,
  import from `./clone.js`.
- `packages/engine/src/plan/schema.ts` — drop private
  `snakeToCamel` + `transformKeys`, import from `./case-keys.js`.
- `packages/engine/src/config/schema.ts` — drop private
  `snakeToCamel` + `transformKeys`, import from
  `../plan/case-keys.js`.
- `packages/engine/src/computations/utils.ts` — add `getDistance`.
- `packages/engine/src/computations/segments.ts` — drop private
  `getDistance`, import from `./utils.js`.
- `packages/engine/src/computations/elevation.ts` — drop private
  `getDistance`, import from `./utils.js`.
- `packages/engine/src/computations/summary.ts` — drop private
  `getDistance`, import from `./utils.js`.
- `packages/engine/src/computations/km-splits.ts` — drop private
  `getDistance`, import from `./utils.js`, inline `?? 0` at the two
  call sites.
- `packages/engine/src/index.ts` — add `export { addDays } from
  "./plan/dates.js";` and `export { transformKeysSnakeToCamel,
  transformKeysCamelToSnake } from "./plan/case-keys.js";` (final
  grouping is the index-rewrite parent's call).
- `packages/cli/src/commands/quantify.ts` — drop private `addDays`,
  import from `@run2max/engine`.
- `packages/cli/src/commands/plan/status.ts` — drop private
  `addDays`, import from `@run2max/engine`.
- `packages/cli/src/commands/plan/sync.ts` — drop private `addDays`,
  import from `@run2max/engine`.
- `packages/cli/src/commands/plan/create.ts` — drop private
  `camelToSnake` + `transformKeysToSnake`, import from
  `@run2max/engine`.

**Deleted**: nothing as a file. All seven `addDays` private copies,
both `clonePlan` private copies, all three forward
`snakeToCamel` + `transformKeys` private copies, the CLI's
`camelToSnake` + `transformKeysToSnake` private copies, and all four
`getDistance` private copies are removed from their host files.

## Dependencies

- Upstream: parent #32 (closed) — `Plan` is `clonePlan`'s input type.
- Upstream: parent #35 (closed) — `walkPlan` already absorbed the
  fifth duplicate (`flattenWeeks`).
- Upstream: parent #38 (closed) — `aggregateBucket` consumers are
  the same files that hold `getDistance` duplicates; the bucketing
  layer is unchanged.
- Upstream: parent #41 (closed) — `addDays` was kept private to
  `plan/status.ts` with an explicit hand-off to this parent.
- Tooling: `pnpm test`, `pnpm --filter @run2max/engine build`, grep.
- No external dependencies. No network. No filesystem state beyond
  the source tree.
