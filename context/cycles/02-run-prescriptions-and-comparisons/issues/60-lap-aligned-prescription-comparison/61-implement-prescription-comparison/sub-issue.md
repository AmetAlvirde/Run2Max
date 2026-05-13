# Sub-Issue #61 -- Implement Prescription Comparison

Vertical slice for parent #60. Delivers the structured engine comparison between
an associated Prescribed Run and the Run's lap-derived Segments, plus the
`AnalysisResult` field that downstream formatter and history parents will
consume.

## Description

Add a pure engine comparison helper that takes the matched Prescribed Run
context from parent #59, actual Segment rows, and Run summary evidence. The
helper returns either available step comparisons or an unavailable result when
usable lap-derived Segments are missing or the Prescribed Step count does not
match the actual Segment count. Available step comparisons classify completion
with asymmetric tolerance boundaries instead of requiring exact duration or
distance matches.

Integrate the helper into `quantify` so a matched Prescribed Run produces
structured `prescriptionComparison` data on `AnalysisResult`. This sub-issue
does not render the comparison, read historical Analysis Artifacts, or infer
step boundaries from raw records.

Out of scope: Markdown/YAML/JSON formatter changes, comparable-history lookup,
history artifact validation, prior-Run deltas, Plan schema changes, CLI flags,
Zone lookup for Target Ranges, and coaching conclusions.

## Dependency classification

| Dependency                                                       | Category   | Testing strategy                                                                                                                                               |
| ---------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PrescribedRunContext`, `PrescribedStep`, and Target Range types | In-process | Construct typed fixtures and assert comparison rows use expanded Prescribed Step order and inline Target Ranges.                                               |
| `SegmentRow` actual lap evidence                                 | In-process | Build Segment fixtures directly for pure helper tests; assert no raw-record matching is required.                                                              |
| `RunSummary` actual run evidence                                 | In-process | Provide summary fixtures with and without `rpe` and `maxHeartRate`; assert run-level evidence is copied deterministically.                                     |
| Existing `computeSegments` lap aggregation                       | In-process | Cover through `quantify` integration tests with normalized lap fixtures; assert comparison availability follows Segment count.                                 |
| `quantify` pipeline                                              | In-process | Call `quantify` with Plan data and FIT fixtures; assert `prescriptionComparison` presence/absence and status.                                                  |
| Formatter profile handling                                       | In-process | Do not change in this sub-issue; add no rendered-output assertions except any existing snapshots that must be updated because `AnalysisResult` typing changed. |

No local-substitutable, remote-owned, collaborator-owned, true external, or
irreplaceable dependency is introduced. No port is needed because comparison is
a pure in-process transformation over engine data with no alternate adapter.

## Interface design

The interface this sub-issue commits to is the structured Prescription
Comparison contract and the pure function used by `quantify` to create it.

### Design-it-twice

**Alternative A -- Minimal comparison helper**

Expose one pure function that accepts already-associated prescription context,
actual Segment rows, and the Run summary.

```ts
export function comparePrescriptionToSegments(
  prescribedRun: PrescribedRunContext,
  segments: SegmentRow[],
  summary: RunSummary,
): PrescriptionComparison;
```

- Leverage: high -- downstream formatter and history work receives one stable
  result shape without learning association or FIT parsing internals.
- Locality: high -- matching rules live in the comparison module and `quantify`
  only wires existing data together.
- Testability: high -- all available and unavailable states can be tested with
  small typed fixtures.

**Alternative B -- Common-caller AnalysisResult builder**

Build comparison from a partially constructed `AnalysisResult` so callers pass a
single object instead of three arguments.

```ts
export function buildPrescriptionComparison(
  result: Pick<AnalysisResult, "prescribedRunContext" | "segments" | "summary">,
): PrescriptionComparison | undefined;
```

- Leverage: medium -- it is convenient for `quantify`, but less useful before an
  `AnalysisResult` exists.
- Locality: medium -- comparison logic knows the broader result shape even
  though it only needs three fields.
- Testability: medium -- tests must construct partial AnalysisResults and can
  accidentally couple to unrelated output fields.

**Alternative C -- FIT-aware comparison pipeline**

Accept raw normalized records and laps, compute Segments internally, and compare
them to the Prescribed Run.

```ts
export function comparePrescribedRunToFit(
  prescribedRun: PrescribedRunContext,
  records: Run2MaxRecord[],
  laps: LapData[],
  summary: RunSummary,
  options: { zones?: ZoneConfig[]; capabilities: DataCapabilities },
): PrescriptionComparison;
```

- Leverage: low -- it duplicates `quantify` responsibilities and invites a
  second Segment pipeline.
- Locality: low -- FIT normalization, Segment aggregation, and prescription
  comparison become one seam.
- Testability: medium -- it can exercise more end-to-end behavior, but small
  comparison cases need heavy FIT fixtures.

### Choice

**A (minimal comparison helper).** It is the smallest surface that preserves the
closed association and Segment seams while giving downstream callers structured
comparison data.

B is rejected in one sentence: accepting a partial `AnalysisResult` couples the
comparison helper to a broader output object than it needs. C is rejected in one
sentence: recomputing Segments inside comparison would blur the FIT-lap boundary
source and create a second aggregation path.

### Public interface

Entry point:

```ts
export function comparePrescriptionToSegments(
  prescribedRun: PrescribedRunContext,
  segments: SegmentRow[],
  summary: RunSummary,
): PrescriptionComparison;
```

Result shape:

```ts
export type PrescriptionComparison =
  | PrescriptionComparisonAvailable
  | PrescriptionComparisonUnavailable;

export interface PrescriptionComparisonAvailable {
  status: "available";
  prescribedRun: PrescriptionComparisonRunContext;
  actual: PrescriptionComparisonRunActuals;
  steps: PrescriptionStepComparison[];
}

export interface PrescriptionComparisonRunContext {
  label: string;
  localDate: string;
  comparisonGroup?: string;
  matchKind: "date" | "override";
  weekNumber: number;
  weekType: string;
}

export interface PrescriptionComparisonRunActuals {
  duration: number;
  distance: number;
  avgPower: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  avgPace: number | null;
  rpe?: number;
}

export interface PrescriptionComparisonUnavailable {
  status: "unavailable";
  reason: "missing_laps" | "step_count_mismatch";
  prescribedRun: PrescriptionComparisonRunContext;
  prescribedStepCount: number;
  actualSegmentCount: number;
}

export interface PrescriptionStepComparison {
  index: number;
  prescribed: {
    source: string;
    target: PrescribedStep["target"];
    intensityLabel?: string;
    targetRange?: PrescribedStep["targetRange"];
  };
  actual: {
    lapIndex: number;
    distance: number;
    duration: number;
    avgPower: number | null;
    avgHeartRate: number | null;
    avgPace: number | null;
  };
  completion: {
    targetKind: "distance" | "duration";
    prescribedValue: number;
    actualValue: number;
    delta: number;
    ratio: number | null;
    status: "within_tolerance" | "short" | "long";
    tolerance: {
      lower: number;
      upper: number;
    };
  };
  power: {
    status: "below" | "within" | "above" | "unavailable";
    actualAvgPower: number | null;
    targetRange?: PrescribedStep["targetRange"];
    deltaToMin?: number;
    deltaToMax?: number;
    reason?: "missing_target_range" | "missing_actual_power";
  };
}
```

Inputs:

- `prescribedRun`: matched context from parent #59, including label, local date,
  optional Comparison Group, match kind, owning Week context, and expanded
  Prescribed Steps.
- `segments`: actual Segment rows derived from FIT lap markers.
- `summary`: Run summary containing run-level max heart rate, average evidence,
  and optional RPE.

Outputs:

- `status: "available"` with one row per Prescribed Step when Segment count and
  Prescribed Step count match and at least one Segment exists.
- `status: "unavailable"` with `missing_laps` when no usable Segment rows exist.
- `status: "unavailable"` with `step_count_mismatch` when Segment count and
  Prescribed Step count differ.

Invariants:

- The function is pure and does not mutate `prescribedRun`, `segments`, or
  `summary`.
- Step matching is by zero-based array order mapped to one-based Prescribed Step
  indexes; `lapIndex` is preserved for diagnostics.
- Distance target comparison converts prescribed kilometers to meters before
  computing delta and ratio.
- Distance completion status uses an asymmetric tolerance window of 50 meters
  short through 200 meters long.
- Duration target comparison uses seconds directly.
- Duration completion status uses an asymmetric tolerance window of 5 seconds
  short through 10 seconds long.
- Completion tolerance boundaries are inclusive. An actual value exactly at the
  lower or upper boundary is `within_tolerance`.
- Power comparison uses only `PrescribedStep.targetRange` and
  `SegmentRow.avgPower`.
- Missing Target Range or missing actual average power is a step-level
  unavailable power result, not a whole-comparison failure.
- Run-level `actual` evidence copies `summary.maxHeartRate` and `summary.rpe`
  without deriving prescribed RPE or per-step RPE.
- A one-step Prescribed Run with one actual Segment is available even if a later
  formatter profile would hide the Segment table.

Error modes:

- Normal unavailable comparison states are returned, not thrown.
- The function does not throw for null metrics inside a Segment row.
- Invalid or contradictory Prescribed Step data should be impossible after Plan
  parsing; if encountered, prefer a deterministic unavailable result or narrow
  assertion in implementation rather than silently fabricating values.

## Acceptance criteria

- `PrescriptionComparison` result types are added to the engine public type
  surface and exported from `@run2max/engine` if needed by downstream tests or
  formatter parents.
- `comparePrescriptionToSegments` is implemented as a pure helper under the
  engine computations area or another clearly named engine module.
- Available comparison pairs each Prescribed Step to the Segment at the same
  order position and preserves Prescribed Step `index` plus Segment `lapIndex`.
- Distance completion converts prescribed `km` values to meters and reports
  actual value, prescribed value, delta, ratio, tolerance boundaries, and
  `within_tolerance`/`short`/`long` status.
- Duration completion reports actual seconds, prescribed seconds, delta, ratio,
  tolerance boundaries, and `within_tolerance`/`short`/`long` status.
- Duration completion treats actual values from `target - 5s` through
  `target + 10s` as `within_tolerance`; lower values are `short`, and higher
  values are `long`.
- Distance completion treats actual values from `target - 50m` through
  `target + 200m` as `within_tolerance`; lower values are `short`, and higher
  values are `long`.
- Power comparison returns `below`, `within`, or `above` when Target Range and
  actual average power are both present, with deterministic deltas to the range
  boundary.
- Missing Target Range and missing actual average power produce step-level
  `unavailable` power evidence with a reason.
- Empty Segment rows produce unavailable reason `missing_laps`.
- Segment/Prescribed Step count mismatch produces unavailable reason
  `step_count_mismatch` with both counts.
- `quantify` attaches `prescriptionComparison` when `prescribedRunContext`
  exists and leaves it absent when no Prescribed Run is associated.
- `quantify` can compute lap-derived Segments for comparison even when config
  Zones are absent; Segment `zone` values may remain `null` in that case.
- No formatter output, history artifact lookup, Plan schema, or CLI behavior is
  changed in this sub-issue except as required by TypeScript type propagation.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and `pnpm build`.

## Proposed tests

1. **Available distance comparison** -- one distance Prescribed Step and one
   Segment produce available comparison with meters-based completion delta,
   ratio, tolerance boundaries, and status.
2. **Available duration comparison** -- one duration Prescribed Step and one
   Segment produce available comparison with seconds-based completion delta,
   ratio, tolerance boundaries, and status.
3. **Duration short boundary** -- `5min` prescribed and `4:55` actual is
   `within_tolerance`, while `4:54` is `short`.
4. **Duration long boundary** -- `5min` prescribed and `5:10` actual is
   `within_tolerance`, while `5:11` is `long`.
5. **Distance short boundary** -- `2.00km` prescribed and `1.95km` actual is
   `within_tolerance`, while `1.949km` is `short`.
6. **Distance long boundary** -- `2.00km` prescribed and `2.20km` actual is
   `within_tolerance`, while `2.201km` is `long`.
7. **Power below range** -- Segment average power below Target Range returns
   `below` and the delta to the minimum bound.
8. **Power within range** -- Segment average power inside Target Range returns
   `within` and no missing-data reason.
9. **Power above range** -- Segment average power above Target Range returns
   `above` and the delta to the maximum bound.
10. **Missing actual power** -- null `avgPower` returns step-level unavailable
   power evidence with `missing_actual_power`.
11. **Missing Target Range** -- a Prescribed Step without `targetRange` returns
   step-level unavailable power evidence with `missing_target_range`.
12. **Missing laps** -- empty Segment rows return unavailable reason
   `missing_laps` and no step comparisons.
13. **Step count mismatch** -- differing Prescribed Step and Segment counts
   return unavailable reason `step_count_mismatch` with both counts.
14. **Run-level RPE present** -- available comparison includes `summary.rpe`
    when provided.
15. **Run-level RPE absent** -- available comparison omits or nulls RPE
    consistently when not provided.
16. **Quantify integration available** -- a FIT fixture with matching Prescribed
    Run and lap count yields an available `prescriptionComparison`.
17. **Quantify integration missing laps** -- a matched Prescribed Run with no
    usable lap-derived Segments yields unavailable `missing_laps` without
    throwing.
18. **No associated Prescribed Run unchanged** -- a normal quantified Run
    without `prescribedRunContext` has no `prescriptionComparison` field.
19. **No Zone config still compares** -- a matched Prescribed Run with FIT laps
    and no Zone config still produces Segment-backed comparison rows with null
    Segment zone data.

## Affected artifacts

- `packages/engine/src/types.ts`
- `packages/engine/src/computations/quantify.ts`
- New or existing engine comparison module under `packages/engine/src/`
- `packages/engine/src/computations/quantify.test.ts`
- New or existing comparison helper tests
- `packages/engine/src/index.ts`
- Any fixture Plan/FIT test data needed for lap-count and no-zone cases
- `context/cycles/02-run-prescriptions-and-comparisons/issues/60-lap-aligned-prescription-comparison/issue.md`
- `context/cycles/02-run-prescriptions-and-comparisons/prd.md` at closure only
  if implementation resolves an open question

## Dependencies

- Parent #53 must remain closed because this sub-issue consumes expanded
  `PrescribedRun.steps` and must not reparse `PrescribedRun.prescription`.
- Parent #59 must remain closed because this sub-issue consumes
  `prescribedRunContext` and must not duplicate Prescribed Run association.
- Existing Segment computation remains the source of actual lap-aligned rows.
- Formatter and comparable-history parents depend on this sub-issue's structured
  result, but their behavior is not required to close this slice.
