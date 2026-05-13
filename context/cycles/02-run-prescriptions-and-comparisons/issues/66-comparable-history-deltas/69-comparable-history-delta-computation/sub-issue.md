# Sub-Issue #69 -- Comparable-History Delta Computation

Vertical slice for parent #66. Delivers the pure engine computation that turns
the current Run's Prescription Comparison actuals and one eligible prior history
artifact into deterministic Comparable-History Deltas. No history artifact
discovery, no `quantify` integration, no `AnalysisResult` shape change, and no
formatter changes happen in this sub-issue.

## Description

Add a pure computation helper that accepts the current Run-level actuals from an
available `PrescriptionComparison` and one `HistoryArtifactEligible` descriptor
from sub-issue #67, computes `current - prior` deltas for every supported
metric, and returns a stable per-prior result with source metadata and
per-metric availability. Metrics with a missing value on either side are
reported as unavailable with explicit reasons rather than omitted, zeroed, or
fabricated.

The helper is the single place where delta direction and per-metric missing
value semantics are defined. Later sub-issues can map it over all eligible
history artifacts during `quantify` integration and render its structured output
without reimplementing metric arithmetic.

Out of scope: scanning Block directories, parsing YAML/JSON, Comparison Group
filtering, choosing eligible artifacts, attaching comparable history to
`AnalysisResult`, changing `PrescriptionComparison`, Markdown/JSON/YAML
rendering, CLI flags, Plan schema changes, persistence layers, and any change to
existing single-Run Prescription Comparison behavior.

## Dependency classification

| Dependency                                         | Category   | Testing strategy                                                                                         |
| -------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| `PrescriptionComparisonRunActuals` from parent #60 | In-process | Unit tests pass literal current actuals and assert each supported metric's delta or unavailable reason.  |
| `HistoryArtifactEligible` from sub-issue #67       | In-process | Unit tests pass literal eligible prior descriptors; no filesystem fixtures or reader calls are needed.   |
| JavaScript number arithmetic                       | In-process | Unit tests assert signed `current - prior` values, including negative pace/RPE deltas and null handling. |
| TypeScript public exports from `@run2max/engine`   | In-process | A public export smoke test imports the helper and result types from the package entry point.             |

No local-substitutable, remote-owned, collaborator-owned, true external, or
irreplaceable dependency is introduced. This sub-issue is intentionally pure and
does not touch filesystem, FIT parsing, Plan loading, formatting, or CLI I/O.

No port is needed. A `ComparableHistoryCalculator` port would have only one
adapter and would hide simple deterministic arithmetic behind indirection.

## Interface design

The interface this sub-issue commits to is one public computation entry point
and the structured per-prior delta shape that later integration attaches under
`prescriptionComparison.comparableHistory`.

### Design-it-twice

**Alternative A -- One-prior pure helper returning a stable metric array**

A single function computes deltas between current actuals and one eligible prior
artifact. Callers map over eligible artifacts themselves.

```ts
export type ComparableHistoryMetric =
  | "avgPower"
  | "avgHeartRate"
  | "maxHeartRate"
  | "avgPace"
  | "rpe";

export type ComparableHistoryUnavailableReason =
  | "missing_current_value"
  | "missing_prior_value"
  | "missing_both_values";

export type ComparableHistoryMetricDelta =
  | ComparableHistoryMetricDeltaAvailable
  | ComparableHistoryMetricDeltaUnavailable;

export interface ComparableHistoryMetricDeltaAvailable {
  metric: ComparableHistoryMetric;
  status: "available";
  current: number;
  prior: number;
  delta: number;
}

export interface ComparableHistoryMetricDeltaUnavailable {
  metric: ComparableHistoryMetric;
  status: "unavailable";
  current: number | null;
  prior: number | null;
  reason: ComparableHistoryUnavailableReason;
}

export interface ComparableHistoryRunDelta {
  sourcePath: string;
  fitBasename: string;
  capturedDate: string;
  comparisonGroup: string;
  metrics: ReadonlyArray<ComparableHistoryMetricDelta>;
}

export function computeComparableHistoryDelta(
  current: PrescriptionComparisonRunActuals,
  prior: HistoryArtifactEligible,
): ComparableHistoryRunDelta;
```

- Leverage: high -- later integration can call the helper once per eligible
  descriptor and attach the returned objects directly.
- Locality: high -- metric order, delta direction, and missing-value reasons
  live in one module.
- Testability: high -- unit tests cover all arithmetic and missing-value cases
  without filesystem fixtures or full `quantify` setup.

**Alternative B -- Batch helper optimized for the integration caller**

One function accepts all current actuals plus a list of eligible prior artifacts
and returns one `ComparableHistoryRunDelta` per prior artifact.

```ts
export function computeComparableHistoryDeltas(
  current: PrescriptionComparisonRunActuals,
  priors: ReadonlyArray<HistoryArtifactEligible>,
): ReadonlyArray<ComparableHistoryRunDelta>;
```

- Leverage: medium -- it saves one `.map()` call in `quantify` integration, but
  no other caller needs batching yet.
- Locality: medium -- it starts to own collection behavior, which belongs closer
  to the integration layer that filters eligible descriptors.
- Testability: high -- arithmetic remains easy to test, but tests must also
  assert list ordering even though ordering is not this helper's main risk.

**Alternative C -- Presentation-oriented comparable-history block**

The helper returns the exact future `prescriptionComparison.comparableHistory`
payload, including top-level unavailable summaries and formatter-facing labels.

```ts
export function buildComparableHistoryBlock(
  current: PrescriptionComparisonRunActuals,
  report: HistoryArtifactReport,
): ComparableHistoryBlock;
```

- Leverage: low for this slice -- it would combine reader status handling, delta
  computation, and future rendering needs before those seams are active.
- Locality: low -- unavailable summary wording and status aggregation would be
  pulled into the arithmetic helper.
- Testability: medium -- it would require reader-shaped fixtures and formatter
  expectations to test behavior that belongs to later sub-issues.

### Choice

**A (one-prior pure helper returning a stable metric array).** It keeps this
slice focused on delta semantics, gives later integration a small and explicit
building block, and avoids owning reader filtering, ordering, or presentation.

B is rejected in one sentence: batching only saves a trivial caller loop while
making this pure helper responsible for collection behavior. C is rejected in
one sentence: a presentation-oriented block would merge future integration and
formatting concerns into the arithmetic seam.

### Public interface

Entry point:

```ts
export function computeComparableHistoryDelta(
  current: PrescriptionComparisonRunActuals,
  prior: HistoryArtifactEligible,
): ComparableHistoryRunDelta;
```

Inputs:

- `current`: the current Run's `PrescriptionComparisonRunActuals` from an
  available single-Run `PrescriptionComparison`.
- `prior`: one `HistoryArtifactEligible` descriptor produced by
  `readHistoryArtifacts` for the same Comparison Group.

Outputs:

- `sourcePath`, `fitBasename`, `capturedDate`, and `comparisonGroup` copied from
  the prior artifact so later formatters can identify the source Run without
  reopening files.
- `metrics`: a stable array in this order: `avgPower`, `avgHeartRate`,
  `maxHeartRate`, `avgPace`, `rpe`.
- Each metric is `available` with `current`, `prior`, and `delta` when both
  sides have finite numeric values.
- Each metric is `unavailable` with `current`, `prior`, and a reason when one or
  both sides lack a finite numeric value.

Invariants:

- Delta direction is always `current - prior`.
- `avgPace` uses the same numeric unit already stored in
  `PrescriptionComparisonRunActuals`; lower/faster interpretation is a rendering
  concern, not a different arithmetic rule.
- `null`, `undefined`, non-finite numbers, and absent optional `rpe` all count
  as missing values for metric availability.
- The helper returns one descriptor for every supported metric, even when the
  metric is unavailable.
- The helper does not filter by Comparison Group. The `HistoryArtifactEligible`
  contract and later integration own that gate.
- The helper does not mutate `current` or `prior`.
- The helper does not call `readHistoryArtifacts`, `quantify`, `formatResult`,
  `parseFitBuffer`, `parsePrescriptionNotation`, `loadPlan`, or any filesystem
  API.

Error modes:

- No domain error is thrown for missing metric values; missing values are
  represented as per-metric `unavailable` descriptors.
- Passing a non-eligible descriptor is a TypeScript programmer error prevented
  by the `HistoryArtifactEligible` input type. Runtime validation is not added
  in this sub-issue.
- Non-finite numeric values are treated as missing, not as thrown exceptions.

## Acceptance criteria

- `computeComparableHistoryDelta` is implemented in the engine package and
  exported from `@run2max/engine` along with `ComparableHistoryMetric`,
  `ComparableHistoryUnavailableReason`, `ComparableHistoryMetricDelta`, and
  `ComparableHistoryRunDelta` types.
- The helper accepts the current Run's `PrescriptionComparisonRunActuals` and
  one `HistoryArtifactEligible` prior descriptor.
- The helper returns prior source metadata: `sourcePath`, `fitBasename`,
  `capturedDate`, and `comparisonGroup`.
- The helper returns metric descriptors for exactly `avgPower`, `avgHeartRate`,
  `maxHeartRate`, `avgPace`, and `rpe`, in that stable order.
- When both current and prior values are finite numbers, each metric descriptor
  has `status: "available"` and `delta: current - prior`.
- When only the current value is missing, the metric descriptor has
  `status: "unavailable"` and `reason: "missing_current_value"`.
- When only the prior value is missing, the metric descriptor has
  `status: "unavailable"` and `reason: "missing_prior_value"`.
- When both values are missing, the metric descriptor has
  `status: "unavailable"` and `reason: "missing_both_values"`.
- Missing optional RPE on either side is unavailable; it is not coerced to zero.
- `avgPace` uses the same `current - prior` direction as every other metric.
- The helper treats `NaN`, `Infinity`, and `-Infinity` as missing values.
- The helper does not mutate either input object.
- No history reader change, no `quantify` integration, no `AnalysisResult` field
  change, no formatter change, no CLI flag, no Plan schema change, and no
  existing Prescription Comparison semantic change is introduced in this
  sub-issue.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and `pnpm build`.

## Proposed tests

1. **Computes available metric deltas** -- current and prior actuals with all
   supported metrics return five `available` descriptors with `current - prior`
   deltas.
2. **Preserves prior source metadata** -- the returned run delta copies
   `sourcePath`, `fitBasename`, `capturedDate`, and `comparisonGroup` from the
   prior descriptor.
3. **Stable metric order** -- the `metrics` array is ordered `avgPower`,
   `avgHeartRate`, `maxHeartRate`, `avgPace`, `rpe` regardless of object key
   order in the inputs.
4. **Missing current value** -- a current `null` metric and prior numeric value
   produce `missing_current_value`.
5. **Missing prior value** -- a current numeric value and prior `null` metric
   produce `missing_prior_value`.
6. **Both values missing** -- `null` or absent values on both sides produce
   `missing_both_values`.
7. **Optional RPE missing on current** -- absent current `rpe` produces an
   unavailable RPE descriptor rather than `0`.
8. **Optional RPE missing on prior** -- absent prior `rpe` produces an
   unavailable RPE descriptor rather than `0`.
9. **Pace uses same direction** -- current pace lower than prior pace produces a
   negative delta, confirming no metric-specific sign flip.
10. **Non-finite values are missing** -- `NaN`, `Infinity`, and `-Infinity` are
    unavailable rather than emitted as deltas.
11. **Does not mutate inputs** -- frozen or copied current and prior objects are
    unchanged after computation.
12. **Public export smoke test** -- consumers can import
    `computeComparableHistoryDelta` and the delta types from `@run2max/engine`.

## Affected artifacts

- `packages/engine/src/computations/comparable-history.ts` (new) -- implements
  `computeComparableHistoryDelta`, supported metric order, delta direction, and
  per-metric missing-value reasons.
- `packages/engine/src/computations/comparable-history.test.ts` (new) -- unit
  tests the pure helper with literal current actuals and eligible prior
  descriptors.
- `packages/engine/src/types.ts` -- add standalone comparable-history delta
  result types if public type locality is preferred there. Do not attach them to
  `AnalysisResult` or `PrescriptionComparisonAvailable` in this sub-issue.
- `packages/engine/src/index.ts` -- export `computeComparableHistoryDelta` and
  the public comparable-history delta types.
- `packages/engine/src/index.test.ts` -- extend the public export smoke test if
  that remains the repository's public API test location.

## Dependencies

- Sub-issue #67 must be closed first because this helper consumes
  `HistoryArtifactEligible` and trusts its Comparison Group and eligibility
  gates.
- Closed parent #60 supplies `PrescriptionComparisonRunActuals` from available
  single-Run Prescription Comparison output.
- Parent #66 must remain the active parent scope.
- Later sub-issues own mapping over all eligible descriptors, attaching the
  returned run deltas to `AnalysisResult.prescriptionComparison`, and rendering
  Markdown/JSON/YAML output.
- Do not call `readHistoryArtifacts`, `scanBlockRuns`, `parseFitBuffer`,
  `parsePrescriptionNotation`, `loadPlan`, `walkPlan`, `quantify`,
  `formatResult`, or any filesystem API from this helper.
- Do not introduce CLI flags, config schema fields, persistence layers, or
  changes to existing Output Profile sections in this sub-issue.
