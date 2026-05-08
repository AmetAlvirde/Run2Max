# Sub-Issue #51 — Plan status formatter fold

## Description

Replace the two formatter exports (`formatDefaultView`, `formatFullView`)
with a single view-parameterized public function:

- `formatPlanStatus(status, { view })` — given a `PlanStatus` and an
  explicit `view: "default" | "full"`, returns the rendered string.

The new function goes under the **Analysis output** banner in
`index.ts`. After this sub-issue lands, the two FOLD-classified
formatter exports are removed from the public surface; the
underlying source module retains the two render functions as
internal helpers so the existing `formatters/plan.test.ts` continues
to pass without modification.

This sub-issue does not change rendering logic, header layout,
milestone phrasing, anomaly section formatting, fractal/mesocycle
grouping, or the `^ current` marker. The output of
`formatPlanStatus(status, { view: "default" })` is byte-identical
to the current `formatDefaultView(status)`; same for `"full"`.

This sub-issue does not redesign `PlanStatus` or `WeekStatusEntry`.
It does not touch the template fold (sub-issue #50). It does not
weaken parent #41's deletion-test seam: `formatters/plan.ts` remains
the only file that imports `PlanStatus` for presentation, and
deleting it leaves the logic layer type-checking.

After this sub-issue closes, `index.ts` exports 32 names (29 KEEP +
2 template API from #50 + 1 new formatter API). The parent #47
≤30 target is still missed by 2; that gap is parent #47's AAR
territory per the parent's existing flag on metric renegotiation.
This sub-issue does not silently exceed 30 — it makes the gap
explicit and hands it to the parent.

## Dependency classification

**In-process.** Inputs are the engine source tree
(`formatters/plan.ts`, `plan/status.ts`, `plan/detect.ts`), the two
CLI consumers (`packages/cli/src/commands/plan/status.ts` and
`packages/cli/src/commands/plan/adjust.ts`), and the existing test
suite. Outputs are edited engine source, edited CLI source, and the
existing verification suites. No external services, no port/adapter,
no mock surface, no filesystem.

The two render functions are pure (`PlanStatus` in, `string` out);
the fold introduces no new effect classes.

## Interface design

### Inputs

- Manifest rows for `formatDefaultView` and `formatFullView`
  (Section 2 of `manifest.md`) and the manifest's fold-target
  rationale (single view-parameterized formatter API).
- Current `packages/engine/src/formatters/plan.ts` for the existing
  rendering semantics being preserved.
- Current `packages/cli/src/commands/plan/status.ts` and
  `packages/cli/src/commands/plan/adjust.ts` for the call patterns
  that must continue to work byte-identically.
- Parent #41's deletion-test seam (re-exported from
  `formatters/plan.ts`, deletable without breaking the logic layer).

### Output

One new public function on `@run2max/engine`, plus updated CLI
imports. Banner placement under **Analysis output** in `index.ts`.

### Design-it-twice on the formatter API shape

- **Alternative A — Required `view` discriminator (per manifest).**
  `formatPlanStatus(status, { view: "default" | "full" }): string`.
  Caller must declare the view at every call site. CLI status
  command passes `"default"` or `"full"` based on the `--full` flag;
  CLI adjust command always passes `"full"`. No default behavior;
  intent is visible at every call site.

- **Alternative B — Optional `view` with default.**
  `formatPlanStatus(status, options?: { view?: "default" | "full" }): string`,
  defaults to `"default"`. Caller can write `formatPlanStatus(status)`
  for the common case. Slight ergonomic win for the most-common
  consumer pattern at the cost of opaque call sites (which view?
  not visible without inspecting the function default).

- **Alternative C — Two named entry points retained.**
  Rename to `formatPlanStatusDefault` / `formatPlanStatusFull`. No
  discriminator needed; intent visible from the function name.
  Keeps two exports, does not satisfy the consolidation goal.

**Chosen: A.** The CLI's two call sites both have explicit intent
about which view they want — `status.ts` toggles based on `--full`,
`adjust.ts` always wants full. Making `view` required preserves
that explicitness at the call site and matches the manifest's
specification. The "default for the common case" affordance from B
saves four characters per call at the cost of obscuring intent.
**Rejection of B**: optional `view` hides intent at the call site
without a corresponding ergonomic gain for the two-consumer surface.
**Rejection of C**: rename without folding — keeps two exports and
fails to consolidate; the manifest explicitly targets one
view-parameterized API, not a renamed pair.

### Final signature

```typescript
function formatPlanStatus(
  status: PlanStatus,
  options: { view: "default" | "full" }
): string;
```

Semantics:

- `formatPlanStatus(status, { view: "default" })` returns the same
  string as today's `formatDefaultView(status)`.
- `formatPlanStatus(status, { view: "full" })` returns the same
  string as today's `formatFullView(status)`.
- The string-literal union for `view` is inline in the function
  signature; no separate `PlanStatusView` type alias is exported.
  (One fewer name on the public surface; the union is a
  single-purpose discriminator, not a reusable domain type.)

Invariants:

- `formatPlanStatus` is pure with respect to `status` and `options`.
- Output is byte-identical to the corresponding pre-fold function
  for every existing fixture and any conceivable `PlanStatus` shape.
- Neither `PlanStatus` nor `WeekStatusEntry` is mutated.

Error modes:

- Invalid `view` literal is a TypeScript compile error; no runtime
  branch needed (strict-mode caller cannot pass an out-of-union
  value).
- `status` shape errors propagate from the underlying render
  functions unchanged (today's behavior on malformed `PlanStatus`
  is preserved — neither function is defensive against a malformed
  status input today, and this fold does not add defenses).

### Source layout

`formatPlanStatus` lives in the existing
`packages/engine/src/formatters/plan.ts`. The two render functions
(`formatDefaultView`, `formatFullView`) remain in that file as
internal helpers (still `export` so the existing
`formatters/plan.test.ts` imports work unchanged). The new function
is a thin switcher:

```typescript
export function formatPlanStatus(
  status: PlanStatus,
  options: { view: "default" | "full" }
): string {
  switch (options.view) {
    case "default":
      return formatDefaultView(status);
    case "full":
      return formatFullView(status);
  }
}
```

**Why a switcher rather than a rewrite into one function:** the two
view implementations differ substantially (default shows current
focus + milestones + unsynced sections; full shows the entire block
structure with mesocycle/fractal grouping and a `^ current`
pointer). A unified function would either grow large branching
internals or push helpers around without semantic gain. The
switcher keeps each view's logic localized; only the public surface
folds. **Why keep the two helpers exported (not made `function`-only):**
`formatters/plan.test.ts` imports them directly via relative path;
keeping the `export` keyword means zero test churn, consistent with
sub-issue #50's pattern (kept folded internals as in-package
exports).

**Parent #41 deletion-test preservation:** `formatters/plan.ts`
remains the sole file importing `PlanStatus`/`WeekStatusEntry` for
presentation. Deleting the file deletes `formatPlanStatus`,
`formatDefaultView`, and `formatFullView` together; the logic layer
(`plan/status.ts`, `plan/detect.ts`) does not import any of them and
keeps type-checking. The deletion-test seam is structurally
unchanged — the public surface name is just consolidated.

### Verification gates

The sub-issue closes only when:

1. `packages/engine/src/index.ts` exports `formatPlanStatus` under
   the **Analysis output** banner.
2. `packages/engine/src/index.ts` no longer exports
   `formatDefaultView` or `formatFullView`. The
   `// TODO(sub-issue #51)` markers placed by sub-issue #49 are
   removed along with the lines they annotate.
3. `packages/cli/src/commands/plan/status.ts` imports
   `formatPlanStatus` from `@run2max/engine`. It does not import
   `formatDefaultView` or `formatFullView`. The `--full` branch
   passes `{ view: "full" }`; the default branch passes
   `{ view: "default" }`.
4. `packages/cli/src/commands/plan/adjust.ts` imports
   `formatPlanStatus` from `@run2max/engine` and uses it inside
   `renderFullView` with `{ view: "full" }`. It does not import
   `formatFullView`.
5. `run2max plan status` and `run2max plan status --full` produce
   byte-identical stdout for every existing CLI fixture. Verified
   by running existing CLI command tests without modification.
6. `run2max plan adjust` (informational mode and strategy/race-date
   modes) produces byte-identical stdout/stderr for every existing
   fixture, including the before/after preview rendered by
   `printBeforeAfter`. Verified by running existing CLI command
   tests without modification.
7. `pnpm test` at the workspace root: green.
   `packages/engine/src/formatters/plan.test.ts` passes without
   modification.
8. `pnpm --filter @run2max/engine build`: green (DTS included).
   Closure-flag from parent #38.
9. `tsc --noEmit` clean — no `TS2589`, no strict-mode regression.
10. The export count in `index.ts` is exactly 32 (29 KEEP + 2
    template API + 1 formatter API). The parent #47 ≤30 target is
    missed by 2; the gap is documented in parent #47's AAR per the
    parent's existing metric-renegotiation flag and is **not**
    addressed by this sub-issue.
11. Parent #41's deletion-test property holds: removing
    `packages/engine/src/formatters/plan.ts` (locally, as a
    verification step — not committed) leaves `pnpm --filter @run2max/engine build`
    of the logic layer (`plan/status.ts`, `plan/detect.ts`,
    `plan/adjust.ts`) type-checking. The build of the engine as a
    whole would fail because `index.ts` re-exports
    `formatPlanStatus`; the seam property is about the logic layer's
    independence, not the package's overall buildability.

## Acceptance criteria

- `packages/engine/src/formatters/plan.ts` exports
  `formatPlanStatus` with the signature in **Final signature**.
- `packages/engine/src/index.ts` re-exports `formatPlanStatus` under
  the **Analysis output** banner; does not re-export
  `formatDefaultView` or `formatFullView`.
- `grep -F` for `formatDefaultView` and `formatFullView` in
  `packages/engine/src/index.ts` returns zero matches.
- `grep -F` for `formatDefaultView` or `formatFullView` in
  `packages/cli/src/**` returns zero matches.
- `packages/cli/src/commands/plan/status.ts` and
  `packages/cli/src/commands/plan/adjust.ts` produce byte-identical
  output to pre-fold for every existing fixture (status default,
  status --full, adjust info mode, adjust strategy mode, adjust
  race-date mode).
- `pnpm test` green. No test file modified.
- `pnpm --filter @run2max/engine build` green. DTS included.
- TypeScript strict mode unchanged. `TS2589` does not regress.
- The export count in `index.ts` is exactly 32. The 2-over gap
  versus the parent's ≤30 target is flagged in this sub-issue's
  AAR for parent #47 to address; it is not adjusted by hiding
  arbitrary additional exports during this fold.
- The internal `formatDefaultView` and `formatFullView` functions
  remain exported from `formatters/plan.ts` (importable by relative
  path within the engine package) so the existing
  `formatters/plan.test.ts` passes unmodified.
- Parent #41's deletion-test seam is unchanged: deleting
  `formatters/plan.ts` leaves `plan/status.ts`, `plan/detect.ts`,
  and `plan/adjust.ts` type-checking.

## Proposed tests

One new test block; existing tests remain unmodified.

- Add a `describe("formatPlanStatus")` block to
  `packages/engine/src/formatters/plan.test.ts` with two cases:
  - `formatPlanStatus(status, { view: "default" })` returns a
    string equal to `formatDefaultView(status)` for the same
    fixture.
  - `formatPlanStatus(status, { view: "full" })` returns a string
    equal to `formatFullView(status)` for the same fixture.
  These are equality-against-the-helper checks, not re-assertions
  of every rendering detail — the existing `describe("formatDefaultView")`
  and `describe("formatFullView")` blocks already exhaustively cover
  the rendering semantics. The new block verifies only that the
  switcher dispatches correctly to each helper.

- No new CLI tests required: the existing
  `packages/cli/test/commands/plan/status.*` and
  `packages/cli/test/commands/plan/adjust.*` fixtures exercise both
  default and full views and the adjust before/after preview;
  byte-identical output is the closure check.

## Affected artifacts

**Modified**:

- `packages/engine/src/formatters/plan.ts` — adds
  `formatPlanStatus` switcher; keeps `formatDefaultView` and
  `formatFullView` exported as internal helpers.
- `packages/engine/src/formatters/plan.test.ts` — adds the
  `describe("formatPlanStatus")` block (two cases). Existing blocks
  unchanged.
- `packages/engine/src/index.ts` — adds `formatPlanStatus` under the
  Analysis output banner; removes `formatDefaultView` and
  `formatFullView` and their `// TODO(sub-issue #51)` markers.
- `packages/cli/src/commands/plan/status.ts` — replaces the
  `args.full ? formatFullView(status) : formatDefaultView(status)`
  ternary with `formatPlanStatus(status, { view: args.full ? "full" : "default" })`.
- `packages/cli/src/commands/plan/adjust.ts` — replaces
  `formatFullView(getPlanStatus(plan))` inside `renderFullView`
  with `formatPlanStatus(getPlanStatus(plan), { view: "full" })`.

**Not modified**:

- `packages/engine/src/plan/status.ts`, `plan/detect.ts`,
  `plan/adjust.ts` — logic layer; this fold is presentation-only.
- `packages/engine/src/formatters/plan.test.ts`'s existing
  `describe("formatDefaultView")` and `describe("formatFullView")`
  blocks — the two helpers stay exported so these continue to work
  as-is.
- All other CLI commands — only `plan/status.ts` and
  `plan/adjust.ts` consume the formatter exports per the manifest's
  consumer index.

**Created**: none.
**Deleted**: none. The folded helpers remain as in-package
internals; only their re-exports from `index.ts` are removed.

## Dependencies

- Upstream: sub-issue #48 (closed) — manifest specifies the fold
  target and the deeper API name.
- Upstream: sub-issue #49 (must close first) — places the
  `// TODO(sub-issue #51)` markers in `index.ts` that this
  sub-issue removes; establishes the banner structure under which
  the new export is placed.
- Sibling: sub-issue #50 (template API fold) — independent; may
  land before or after #51. Parent #47 closes once both #50 and
  #51 land along with parent-level closure work.
- Upstream constraint: parent #41 deletion-test seam — this
  sub-issue must preserve the property that deleting
  `formatters/plan.ts` leaves the logic layer type-checking.
- Tooling: `pnpm test`, `pnpm --filter @run2max/engine build`, grep
  against `packages/engine/src/index.ts` and `packages/cli/src/**`,
  existing CLI command-test fixtures for byte-identical output
  verification.
- No external dependencies. No network. No filesystem.
