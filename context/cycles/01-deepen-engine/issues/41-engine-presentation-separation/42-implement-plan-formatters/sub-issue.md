# Sub-Issue #42 — Move plan formatters and split status tests

Vertical slice for parent issue #41. Delivers the full parent scope as a
single behaviour-preserving change: design the formatter location, relocate
`formatDefaultView` / `formatFullView` (and their private helpers) out of
`plan/status.ts` into `formatters/plan.ts`, split `plan/status.test.ts` into
a structural-only file plus a new `formatters/plan.test.ts`, and update the
engine's public surface and CLI imports as needed.

## Description

The engine's plan layer today owns both the computation of plan status
(`getPlanStatus`) and the rendering of two views over that status
(`formatDefaultView`, `formatFullView`). Both live in
`packages/engine/src/plan/status.ts` (338 lines) and both are tested
together in `packages/engine/src/plan/status.test.ts` (522 lines), where
~17 assertions check rendered strings.

This sub-issue separates the two layers:

- `plan/status.ts` becomes a pure computation module: `getPlanStatus` plus
  the data types (`PlanStatus`, `WeekStatusEntry`, `NextMilestone`,
  `WeekMarker`, `PlanStatusOptions`) and a private `addDays` it uses for
  the past/future week-end boundary.
- `formatters/plan.ts` becomes the rendering module: `formatDefaultView`
  and `formatFullView` plus their private helpers (`buildHeader`,
  `relativeLabel`, `weekToFullToken`).
- `plan/status.test.ts` keeps every structural assertion and drops every
  rendered-string assertion (the `formatDefaultView` / `formatFullView`
  describe blocks plus the rendering-leaning assertions in the deviation
  surfacing describes).
- `formatters/plan.test.ts` is **new** and absorbs every rendered-string
  assertion that left `status.test.ts`. The same plan fixtures and
  helpers (`makeFullPlan`, `makeSingleFractalPlan`) are reused; if both
  test files need them, they relocate to a shared in-package fixture
  module rather than being duplicated.
- Engine's public surface re-exports the formatters from
  `./formatters/plan.js`. CLI imports remain on the `@run2max/engine`
  surface and do not change.

The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` open question on
formatter location (engine-public vs CLI-internal) is decided in the
design-it-twice section below.

The slice is sized to deliver the full parent scope. If implementation
reveals the slice is too large (e.g. test-fixture relocation surfaces a
question worth its own decision), a sibling sub-issue #43 is added.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| TypeScript compiler | In-process | Test directly: type-check is part of `pnpm test`; DTS build runs separately. |
| `vitest` | In-process | Existing engine and CLI test suites run as-is. |
| `Plan` and Plan-family types (`plan/types.ts`) | In-process | Test directly: consumed by `getPlanStatus` and indirectly by the formatters via `PlanStatus`. |
| `walkPlan` (`plan/walk.ts`) | In-process | Test directly: consumed by `getPlanStatus`. Its surface does not change. |
| `DeviationReport` and `reportHasAnomalies` (`plan/detect.ts`) | In-process | Test directly: `getPlanStatus` consumes them for unsynced-past enrichment; `weekToFullToken` and the default-view's anomaly grouping consume `reportHasAnomalies`. After this sub-issue, the latter two consumers live under `formatters/plan.ts`. |
| `parsePlan` (`plan/schema.ts`) | In-process | Test directly: used by both new test files to build fixtures. |
| Existing CLI command tests for `plan status` and `plan adjust` | In-process | Test directly: run unchanged; their continued green is the user-facing-byte-identity net. |

No remote, collaborator-owned, or external dependencies. No port required —
only one consumer of the formatters exists today (the CLI), so introducing
a port would be indirection without a real second adapter.

## Interface design

The interface this sub-issue must commit to is:

1. The **module boundary** between `plan/status.ts` and the new formatter
   module — what each side imports from the other.
2. The **public surface** of `@run2max/engine` for `formatDefaultView` /
   `formatFullView` — whether the engine continues to export them, and
   under which path.
3. The **test ownership boundary** — which scenarios live in
   `plan/status.test.ts` (structural) vs `formatters/plan.test.ts`
   (rendering).

The runtime behaviour of every consumer is preserved: CLI output is
byte-identical, `PlanStatus` shape is unchanged, formatter output strings
are unchanged.

### Design-it-twice (formatter location and public surface)

**Alternative A — `packages/engine/src/formatters/plan.ts`, re-exported
from `engine/index.ts`**

The formatters live in the engine package alongside the existing
`formatters/index.ts` (which holds `formatResult` for `AnalysisResult`).

```ts
// packages/engine/src/formatters/plan.ts
import type { PlanStatus, WeekStatusEntry } from "../plan/status.js";
import { reportHasAnomalies } from "../plan/detect.js";

export function formatDefaultView(status: PlanStatus): string;
export function formatFullView(status: PlanStatus): string;

// private helpers stay in this file
function buildHeader(status: PlanStatus): string;
function relativeLabel(weeksFromNow: number): string;
function weekToFullToken(w: WeekStatusEntry): string;
```

```ts
// packages/engine/src/index.ts (under Plan grouping)
export { getPlanStatus } from "./plan/status.js";
export type { PlanStatus, WeekStatusEntry, NextMilestone, WeekMarker, PlanStatusOptions } from "./plan/status.js";
// ... (same line as today, minus formatDefaultView/formatFullView)

// (under Formatters grouping, alongside formatResult)
export { formatDefaultView, formatFullView } from "./formatters/plan.js";
```

CLI imports remain on `@run2max/engine`:

```ts
// packages/cli/src/commands/plan/status.ts (unchanged)
import {
  getPlanStatus,
  formatDefaultView,
  formatFullView,
  // ...
} from "@run2max/engine";
```

- Leverage: medium-high — one home for plan rendering, sitting next to
  the other formatter family in the engine's `formatters/`. The engine's
  public surface continues to give every downstream consumer one import
  path. The next consumer (web client, hypothetical) gets the same
  ergonomics the CLI has today.
- Locality: high — `plan/status.ts` no longer imports `reportHasAnomalies`
  twice (currently the file imports it once for `weekToFullToken` and
  the default view's anomaly grouping; after the move, it imports it only
  for `getPlanStatus`'s deviation enrichment, and the formatter module
  imports it independently). The plan layer and the formatter layer are
  decoupled via `PlanStatus` only.
- Testability: high — two focused test files, each owning one concern.
  The deletion test (cycle PRD success signal) holds: deleting
  `formatters/plan.ts` and its re-export lines in `index.ts` leaves the
  engine's logic layer type-checking.

**Alternative B — `packages/cli/src/commands/plan/format.ts`, CLI-internal**

The formatters move to the CLI package. The engine's public surface drops
`formatDefaultView` and `formatFullView` entirely.

```ts
// packages/cli/src/commands/plan/format.ts
import type { PlanStatus, WeekStatusEntry } from "@run2max/engine";
import { reportHasAnomalies } from "@run2max/engine"; // requires public re-export

export function formatDefaultView(status: PlanStatus): string;
export function formatFullView(status: PlanStatus): string;
```

```ts
// packages/cli/src/commands/plan/status.ts
import { getPlanStatus } from "@run2max/engine";
import { formatDefaultView, formatFullView } from "./format.js";
```

- Leverage: low — only the CLI consumes the formatters today, so locating
  them in the CLI is technically correct. But this requires the engine to
  publicly re-export `reportHasAnomalies` (today it is exported, so this
  is no change — but the dependency surface widens conceptually: the CLI
  now owns rendering responsibilities the engine previously owned).
- Locality: medium — moves the seam across a package boundary. A future
  second consumer (web, etc.) cannot reuse the formatters without either
  duplicating them or carving a shared package — both wider than this
  parent's scope.
- Testability: medium — `formatters/plan.test.ts` would live in the CLI
  package, requiring CLI-package test fixtures and possibly a new
  fixture-helper module. Today's `plan/status.test.ts` builds plans via
  `parsePlan` (engine), so the CLI test would import `parsePlan` and
  rebuild fixtures CLI-side. Workable, but more friction than A.

**Alternative C — `packages/engine/src/formatters/plan.ts`, **not**
re-exported from `engine/index.ts`**

Formatters live in the engine but are imported via a sub-path
(`@run2max/engine/formatters/plan`). The engine's `index.ts` does not
re-export them; the CLI imports them through the sub-path.

- Leverage: medium — same module location as A, but a narrower public
  surface. Pays a real cost: today's `index.ts` is the only public
  surface for the engine; introducing a sub-path export turns the
  package into a multi-entrypoint package, which the cycle PRD's
  `index.ts`-rewrite parent has not decided to do. Forcing that
  decision here is scope creep.
- Locality: identical to A.
- Testability: identical to A; the test file lives in the same place.

### Choice

**A (formatters in `engine/formatters/plan.ts`, re-exported from
`engine/index.ts`).** The formatters belong with the other formatter
family already in the engine package, the engine's existing single-entry
public surface accommodates them without requiring a multi-entrypoint
decision, and the CLI does not need to change its imports. The deletion
test for the engine/presentation seam is a property of the import graph
(`plan/` does not depend on `formatters/`), not of the package layout —
A satisfies it.

B is rejected in one sentence: only one consumer exists today, but
moving the formatters across a package boundary now would force a
second move (or a new shared package) the moment a second consumer
appears, and there is no concrete cost to keeping them engine-side
in the meantime.

C is rejected in one sentence: introducing a multi-entrypoint engine
package is the public-surface-rewrite parent's decision space, not
this parent's, and forcing it here couples two parents that the cycle
PRD intentionally separates.

This decision answers the cycle PRD's `RESOLVE THROUGH IMPLEMENTATION`
open question on `formatters/plan.ts`'s public/internal status. After
parent #41 closes, update `context/cycles/01-deepen-engine/prd.md` to
mark it resolved with the chosen shape.

The cycle PRD flags this as a borderline ADR candidate; rationale
captured here is the seed for that ADR if one is written at parent
close.

### Module boundaries (post-move)

```
plan/status.ts
  exports:
    type PlanStatus, WeekStatusEntry, NextMilestone, WeekMarker, PlanStatusOptions
    function getPlanStatus
  imports:
    type Plan from "./types.js"
    type DeviationReport from "./detect.js"
    function reportHasAnomalies from "./detect.js" (used in getPlanStatus's
      enrichment of unsynced_past entries)
    function walkPlan from "./walk.js"
  private helpers:
    function addDays (used only inside getPlanStatus for week-end boundary)

formatters/plan.ts (new)
  exports:
    function formatDefaultView
    function formatFullView
  imports:
    type PlanStatus, WeekStatusEntry from "../plan/status.js"
    function reportHasAnomalies from "../plan/detect.js"
  private helpers:
    function buildHeader
    function relativeLabel
    function weekToFullToken

engine/index.ts (delta)
  - export { getPlanStatus, formatDefaultView, formatFullView } from "./plan/status.js";
  + export { getPlanStatus } from "./plan/status.js";
  + export { formatDefaultView, formatFullView } from "./formatters/plan.js";
```

Invariants:
- `plan/` does not import from `formatters/`. Verified by grep at parent
  close.
- `formatters/plan.ts` does not import from `plan/` for any computation
  helper — only types (`PlanStatus`, `WeekStatusEntry`) and the existing
  `reportHasAnomalies` predicate. Verified by inspection.
- `getPlanStatus`'s output shape, marker semantics, milestone selection,
  and unsynced-past enrichment behaviour are byte-identical pre/post.
- `formatDefaultView` and `formatFullView` produce byte-identical output
  pre/post for the same `PlanStatus` input.

Error modes: none new. The functions move; their bodies (and thus their
error behaviour, which today is "no throws, returns strings") are
unchanged.

### Test ownership boundary

Today's `packages/engine/src/plan/status.test.ts` has the following
top-level describe blocks (line numbers from current source):

- `describe("getPlanStatus", ...)` (line 87) — **stays in
  `plan/status.test.ts`**. All 14 `it` blocks assert on `PlanStatus`
  shape (current week, completion, week index/total, mesocycle/fractal
  position, marker classification for each marker type, milestones,
  unsynced groupings as data, single-fractal handling, all-synced
  handling).
- `describe("formatDefaultView", ...)` (line 282) — **moves to
  `formatters/plan.test.ts`**. 3 `it` blocks, all asserting on rendered
  strings.
- `describe("formatFullView", ...)` (line 316) — **moves to
  `formatters/plan.test.ts`**. 6 `it` blocks, all asserting on rendered
  strings (header, current marker, ok/deviated/unsynced/future token
  formats).
- `describe("deviation surfacing in default view", ...)` (line 417) —
  **moves to `formatters/plan.test.ts`**. 5 `it` blocks; all assert on
  rendered strings (anomaly section, anomaly detail line, omission
  rules, backward-compat plain section).
- `describe("deviation surfacing in full view (?/??)", ...)` (line 486) —
  **moves to `formatters/plan.test.ts`**. 3 `it` blocks; all assert on
  the `??` / `?` marker characters in rendered strings.

Net effect: structural describe (`getPlanStatus`) stays; four rendering
describes move. Total `it` count is preserved. No scenario is dropped.

The existing fixture helpers `makeSingleFractalPlan` (line 9) and
`makeFullPlan` (line 33) are needed by both files post-split. They
relocate to a small in-package fixtures module
(`packages/engine/src/plan/__tests__/fixtures.ts` or
`packages/engine/src/plan/status.fixtures.ts`) and both test files
import from there. The fixture-module name is decided during sub-issue
implementation; either is acceptable and does not warrant a
design-it-twice section.

If the fixture-relocation step balloons (e.g. types or shared helpers
that are not test-only need extraction), it is flagged for a sibling
sub-issue #43 and this sub-issue lands a minimal duplicate of the two
helpers in the new test file, with a TODO referencing the flag.

## Acceptance criteria

- `packages/engine/src/formatters/plan.ts` exists and exports
  `formatDefaultView` and `formatFullView` with bodies and behaviour
  identical to today's `plan/status.ts` versions. Private helpers
  `buildHeader`, `relativeLabel`, and `weekToFullToken` are in this
  file.
- `packages/engine/src/plan/status.ts` no longer exports or defines
  `formatDefaultView`, `formatFullView`, `buildHeader`,
  `relativeLabel`, or `weekToFullToken`. Its file size is materially
  smaller (target: under 200 lines, down from 338).
- `packages/engine/src/index.ts` exports `getPlanStatus` from
  `./plan/status.js` and `formatDefaultView` / `formatFullView` from
  `./formatters/plan.js`. The status data type re-exports
  (`PlanStatus`, `WeekStatusEntry`, etc.) stay where they are today
  (from `./plan/status.js`).
- `packages/engine/src/plan/status.test.ts` contains only the
  `describe("getPlanStatus", ...)` block (and any retained shared
  imports). All four rendering-related describes have moved.
- `packages/engine/src/formatters/plan.test.ts` exists and contains
  the four rendering describes (`formatDefaultView`, `formatFullView`,
  `deviation surfacing in default view`, `deviation surfacing in full
  view (?/??)`) with their `it` blocks intact, importing from
  `./plan.js`.
- Both new test files share fixture helpers (`makeFullPlan`,
  `makeSingleFractalPlan`) via a single in-package fixtures module,
  rather than duplicating them. If duplication is unavoidable due to
  scope, a flag for sibling sub-issue #43 is recorded.
- `packages/cli/src/commands/plan/status.ts` and
  `packages/cli/src/commands/plan/adjust.ts` continue to import
  `formatDefaultView` and `formatFullView` from `@run2max/engine`
  unchanged — Alternative A makes this a no-op for the CLI.
- `pnpm test` at the workspace root is green with no test
  modifications beyond the relocations described.
- `pnpm --filter @run2max/engine build` succeeds (DTS + JS),
  satisfying the closure-flag carried forward from parent #38.
- Grep verification: `grep -rn "formatDefaultView\|formatFullView" packages/engine/src/plan/` returns zero matches.
  `grep -rn "buildHeader\|relativeLabel\|weekToFullToken" packages/engine/src/plan/` returns zero matches.
- Inspection verification (deletion test): `packages/engine/src/plan/`
  contains zero imports of `../formatters/plan.js` or any rendering
  helper. Recorded in the parent close.
- TypeScript strict mode stays on. `TS2589` is not emitted at any
  point during the change.
- CLI behaviour byte-identity: `pnpm --filter @run2max/cli test` stays
  green without modifications to CLI tests, confirming user-facing
  output is unchanged.

## Proposed tests

1. **`packages/engine/src/plan/status.test.ts` (slimmed)** — retains
   the existing `describe("getPlanStatus", ...)` block, including all
   14 `it` blocks. No assertion changes; this is a relocation-only
   change to remove the rendering describes. The file imports
   `getPlanStatus` from `./status.js` and the fixture helpers from the
   new shared fixture module.
2. **`packages/engine/src/formatters/plan.test.ts` (new)** — holds
   the four rendering describes that moved out of `status.test.ts`:
   - `formatDefaultView` (3 `it` blocks)
   - `formatFullView` (6 `it` blocks)
   - `deviation surfacing in default view` (5 `it` blocks)
   - `deviation surfacing in full view (?/??)` (3 `it` blocks)
   The `it` body content is unchanged. The file imports
   `formatDefaultView` / `formatFullView` from `./plan.js`,
   `getPlanStatus` from `../plan/status.js`, the fixture helpers from
   the shared fixture module, and `DeviationReport` from
   `../plan/detect.js` for the deviation-surfacing tests.
3. **Existing CLI command tests pass unchanged.**
   `packages/cli/test/commands/plan/status.test.ts` and
   `packages/cli/test/commands/plan/adjust.test.ts` (or their
   equivalents in the CLI test layout) continue to pass without
   modification — they exercise the rendered output via the CLI
   surface, providing the user-facing-byte-identity regression net.
4. **No new behavioural test is added.** This sub-issue is a
   relocation; new behaviour would be scope drift. If existing test
   coverage gaps are discovered (e.g. a marker boundary is asserted
   only via a rendered string and not via the structural shape),
   record the gap as a flag on parent #41 rather than expanding this
   sub-issue.
5. **Manual verification step.** Run `run2max plan status` and
   `run2max plan status --full` against an existing plan fixture
   pre/post-change; diff CLI output and confirm byte-identity. Same
   for `run2max plan adjust` preview output. Recorded in the sub-issue
   AAR.

## Affected artifacts

- `packages/engine/src/formatters/plan.ts` — **new file**, holds
  `formatDefaultView`, `formatFullView`, and the three private
  rendering helpers. Body content is the verbatim relocation of lines
  ~175–338 of today's `plan/status.ts` with import-path adjustments.
- `packages/engine/src/formatters/plan.test.ts` — **new file**, holds
  the four rendering describes relocated from `plan/status.test.ts`.
- `packages/engine/src/plan/status.ts` — remove the formatters and
  their helpers (lines ~175–338 of today's source) and the
  Default-view / Full-view / Formatting-helpers section banners. The
  file's remaining content is the type definitions, `getPlanStatus`,
  and the private `addDays` helper.
- `packages/engine/src/plan/status.test.ts` — remove the four
  rendering describes (`formatDefaultView`, `formatFullView`, both
  deviation-surfacing describes). Adjust imports to drop
  `formatDefaultView` / `formatFullView` and to pull fixture helpers
  from the new shared module.
- `packages/engine/src/plan/__tests__/fixtures.ts` (or
  `packages/engine/src/plan/status.fixtures.ts`) — **new file**
  (location decided during implementation), holds `makeFullPlan` and
  `makeSingleFractalPlan` as exported helpers. Both new test files
  import from here. If sub-issue scope tightens to avoid this, both
  test files duplicate the helpers and a flag is recorded.
- `packages/engine/src/index.ts` — adjust the line `export {
  getPlanStatus, formatDefaultView, formatFullView } from
  "./plan/status.js"` to `export { getPlanStatus } from
  "./plan/status.js"`, and add `export { formatDefaultView,
  formatFullView } from "./formatters/plan.js"` under the Formatters
  grouping.
- `packages/cli/src/commands/plan/status.ts` — **no change** under
  Alternative A (imports `formatDefaultView` / `formatFullView` from
  `@run2max/engine`, which still re-exports them).
- `packages/cli/src/commands/plan/adjust.ts` — **no change** under
  Alternative A.

## Dependencies

- Upstream sub-issues: parent #32 / sub-issue #33 (closed) — Plan
  named interfaces; parent #35 / sub-issue #36 (closed) — `walkPlan`
  consumed by `getPlanStatus`. Both are stable and unchanged.
- External services: none.
- Test fixtures: existing fixtures (`makeFullPlan`,
  `makeSingleFractalPlan`) are reused unchanged. Their location moves
  to a shared in-package fixture module.
