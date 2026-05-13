# Sub-Issue #70 -- Quantify Comparable-History Integration

Vertical slice for parent #66. Delivers the engine integration that attaches
Comparable-History results to an available `prescriptionComparison` during
`quantify`. This slice consumes the closed history reader from sub-issue #67 and
the closed delta helper from sub-issue #69. No Markdown rendering, no formatter
wording changes, no new Output Profile section, and no history-reader or delta
arithmetic changes happen in this sub-issue.

## Description

Extend `quantify` so a Prescribed Run with a Comparison Group can look up prior
Analysis Artifacts in the same Block directory, compute Comparable-History
Deltas for eligible prior Runs, and attach the structured result under the
current Run's available `prescriptionComparison`.

The integration must remain inert unless all of these are true: a Prescribed Run
association succeeds, the single-Run Prescription Comparison is `available`, the
Prescribed Run carries a Comparison Group, a Block directory path is available,
and the current Run's FIT basename is available. This keeps no-group and
unavailable single-Run comparison behavior exactly as parent #63 left it.

Out of scope: changing `readHistoryArtifacts`, changing
`computeComparableHistoryDelta`, rendering Comparable-History in Markdown,
asserting JSON/YAML formatter output, adding CLI flags, adding Plan schema
fields, introducing persistence, reparsing Prescription Notation, rerunning
Prescribed Run association, recomputing Segments, or changing Zone behavior.

## Dependency classification

| Dependency                                         | Category      | Testing strategy                                                                                                                                                                                                     |
| -------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readHistoryArtifacts` from sub-issue #67          | In-process    | Integration tests use a real fixture Block directory and assert that `quantify` calls the reader only when the gating conditions are met, through observable `AnalysisResult` output rather than mocking the reader. |
| `computeComparableHistoryDelta` from sub-issue #69 | In-process    | Integration tests assert the attached per-prior metrics match the pure helper's `current - prior` semantics for at least one prior artifact.                                                                         |
| `PrescriptionComparisonAvailable` from parent #60  | In-process    | Tests first produce an available single-Run comparison, then assert `comparableHistory` is attached without changing existing `actual` or `steps` fields.                                                            |
| `QuantifyOptions.fitDirPath`                       | In-process    | Tests pass a fixture directory path; when omitted, Comparable-History lookup remains absent.                                                                                                                         |
| Current FIT basename provided to `quantify`        | In-process    | Add an optional `currentFitBasename` input and assert the current artifact is excluded. The CLI derives it from the existing file argument, so no new CLI flag is needed.                                            |
| Node path basename handling in the CLI             | In-process    | CLI tests assert the existing file path is converted to `currentFitBasename` before calling `quantify`; no filesystem port is introduced.                                                                            |
| Filesystem access inside `readHistoryArtifacts`    | Irreplaceable | Exercised indirectly by fixture Block directories; this sub-issue does not add a second filesystem abstraction.                                                                                                      |

No local-substitutable, remote-owned, collaborator-owned, or true external
dependency is introduced. No port is needed: both consumed collaborators are
owned in-process functions, and the only real boundary remains the filesystem
already owned by the reader.

## Interface design

The interface this sub-issue commits to is the `AnalysisResult` shape added to
an available `prescriptionComparison`, plus the minimum `QuantifyOptions` input
needed to identify the current FIT basename.

### Design-it-twice

**Alternative A -- Minimal integration-owned comparableHistory block**

`quantify` calls the reader and maps eligible descriptors through the delta
helper. The attached block records either computed prior Run deltas or a concise
unavailable reason derived from the reader report.

```ts
export interface QuantifyOptions {
  fitDirPath?: string;
  currentFitBasename?: string;
}

export type ComparableHistory =
  | ComparableHistoryAvailable
  | ComparableHistoryUnavailable;

export interface ComparableHistoryAvailable {
  status: "available";
  runs: ReadonlyArray<ComparableHistoryRunDelta>;
}

export interface ComparableHistoryUnavailable {
  status: "unavailable";
  reason: "no_candidates" | "all_candidates_unavailable";
  candidates: ReadonlyArray<HistoryArtifactUnavailable>;
}

export interface PrescriptionComparisonAvailable {
  status: "available";
  prescribedRun: PrescriptionComparisonRunContext;
  actual: PrescriptionComparisonRunActuals;
  steps: PrescriptionStepComparison[];
  comparableHistory?: ComparableHistory;
}
```

- Leverage: high -- later formatters can render available rows or an unavailable
  line from one stable block without rerunning lookup.
- Locality: high -- `quantify` owns orchestration while reader classification
  and delta arithmetic remain in their closed helpers.
- Testability: high -- integration tests assert a single output shape without
  rendering Markdown or serializing YAML.

**Alternative B -- Store raw reader report plus computed runs**

Attach both the full `HistoryArtifactReport` and computed deltas under
`prescriptionComparison.comparableHistory`.

```ts
export interface ComparableHistoryBlock {
  report: HistoryArtifactReport;
  runs: ReadonlyArray<ComparableHistoryRunDelta>;
}
```

- Leverage: medium -- formatters get all diagnostics, including mismatch and
  parse-failure details.
- Locality: medium -- the AnalysisResult begins exposing reader internals that
  were designed primarily for eligibility, not presentation.
- Testability: medium -- tests must assert noisy classification detail that is
  already covered by reader tests.

**Alternative C -- Formatter-owned lazy lookup**

Leave `AnalysisResult` unchanged and have the formatter run history lookup when
rendering `prescription_comparison`.

```ts
formatResult(result, "markdown", profile, { historyLookupContext });
```

- Leverage: low -- only rendering callers can use history, while JSON/YAML
  structured output still lacks a durable contract.
- Locality: low -- formatters would gain filesystem and engine-computation
  responsibilities.
- Testability: low -- output tests would need filesystem fixtures and async
  formatter behavior.

### Choice

**A (minimal integration-owned comparableHistory block).** It attaches the
parent's structured data at the engine boundary, keeps lookup and arithmetic in
their existing modules, and gives the next formatter slice a simple data
contract.

B is rejected in one sentence: exposing the full reader report leaks
classification internals into `AnalysisResult` when later rendering only needs
eligible deltas plus a summary unavailable reason. C is rejected in one
sentence: moving lookup into formatters would mix rendering with filesystem I/O
and leave structured JSON/YAML output without an engine-owned contract.

### Public interface

Entry points:

```ts
export async function quantify(
  fitBuffer: ArrayBuffer,
  options?: QuantifyOptions,
): Promise<AnalysisResult>;
```

Modified inputs:

- `QuantifyOptions.fitDirPath`: existing Block directory path. Required for
  Comparable-History lookup; lookup is skipped when absent.
- `QuantifyOptions.currentFitBasename`: new optional basename of the current FIT
  File without `.fit`. Required for Comparable-History lookup so the reader can
  exclude the current Run's own Analysis Artifact.
- CLI `quantify` command: derives `currentFitBasename` from the existing
  positional FIT file path and passes it to the engine. This is not a new CLI
  flag and does not change command syntax.

Modified outputs:

- `PrescriptionComparisonAvailable.comparableHistory` is present only when the
  integration gate runs.
- `status: "available"` includes one `ComparableHistoryRunDelta` per eligible
  prior artifact, preserving the reader's deterministic candidate order.
- `status: "unavailable"` includes the reader top-level reason and the
  unavailable candidate descriptors needed by later formatters to name the
  reason without rescanning files.
- `PrescriptionComparisonUnavailable` is unchanged and never receives
  `comparableHistory`.

Invariants:

- `readHistoryArtifacts` is never called when there is no Comparison Group.
- `readHistoryArtifacts` is never called when the single-Run
  `prescriptionComparison` is unavailable.
- `readHistoryArtifacts` is never called without both `fitDirPath` and
  `currentFitBasename`.
- The current Run's own FIT basename is passed through unchanged for reader-side
  exclusion.
- The integration does not alter `prescriptionComparison.actual`,
  `prescriptionComparison.steps`, `prescribedRunContext`, or `planContext`.
- Missing prior/current metric values remain per-metric unavailable descriptors
  from `computeComparableHistoryDelta`; integration does not drop or rewrite
  them.
- The Output Profile section ID remains `prescription_comparison`; this slice
  does not add a formatter gate.

Error modes:

- Reader parse failures, partial artifacts, ambiguous artifacts, and group
  mismatches are represented in the attached unavailable block when no eligible
  prior exists.
- Filesystem read failure for the Block directory remains the reader's
  `no_candidates` report, not a thrown `quantify` error.
- Missing `fitDirPath` or `currentFitBasename` silently skips history lookup to
  preserve direct engine API callers that only provide an `ArrayBuffer`.

## Acceptance criteria

- `QuantifyOptions` gains optional `currentFitBasename`; the CLI derives it from
  the existing FIT file path and passes it with the existing `fitDirPath`.
- `PrescriptionComparisonAvailable` gains optional `comparableHistory` with an
  available/unavailable structured shape. `PrescriptionComparisonUnavailable`
  remains unchanged.
- When a matched Prescribed Run has a Comparison Group, the comparison is
  available, and both `fitDirPath` and `currentFitBasename` are present,
  `quantify` reads prior history artifacts and attaches computed
  Comparable-History Deltas for every eligible prior artifact.
- When no eligible prior artifact exists but lookup runs, `quantify` attaches a
  structured unavailable `comparableHistory` block using the reader's top-level
  reason and unavailable candidate descriptors.
- When the Prescribed Run has no Comparison Group, `quantify` does not run
  history lookup and the resulting `prescriptionComparison` matches the
  pre-history shape.
- When the single-Run `prescriptionComparison` is unavailable, `quantify` does
  not run history lookup and does not attach `comparableHistory`.
- When `fitDirPath` or `currentFitBasename` is absent, `quantify` does not run
  history lookup and does not attach `comparableHistory`.
- The current FIT basename is excluded from candidates through the reader input;
  a saved Analysis Artifact for the current Run does not produce a self-delta.
- Existing `quantify` tests for plan context, prescribed-run association, and
  single-Run Prescription Comparison continue to pass without fixture history
  setup.

## Proposed tests

- Add `quantify` integration tests using a fixture Block directory with prior
  `.fit` plus YAML/JSON Analysis Artifacts. Assert an available
  `prescriptionComparison.comparableHistory` contains one prior Run with source
  path, captured date, comparison group, and per-metric deltas.
- Add a test where all candidates are unavailable and assert
  `comparableHistory.status === "unavailable"` with the reader top-level reason
  and candidate reasons preserved.
- Add a test where the current basename has its own Analysis Artifact in the
  fixture directory and assert no self-delta is produced.
- Add tests for each inert gate: no Comparison Group, unavailable single-Run
  comparison, missing `fitDirPath`, and missing `currentFitBasename`.
- Add a CLI command test that verifies the existing FIT file argument is passed
  to `quantify` as `currentFitBasename` without adding a new CLI flag.
- Keep existing reader and delta helper unit tests unchanged; this slice should
  not duplicate their full classification or arithmetic matrices.

## Affected artifacts

- `packages/engine/src/types.ts`
- `packages/engine/src/computations/quantify.ts`
- `packages/engine/src/computations/quantify.test.ts`
- `packages/cli/src/commands/quantify.ts`
- `packages/cli/src/commands/quantify.test.ts`
- `packages/engine/src/index.ts` if the new `ComparableHistory` result types
  need public export alongside the existing delta types.
- Fixture files under `packages/engine/src/computations/__fixtures__/` or an
  equivalent existing fixture location.

## Dependencies

- Upstream: sub-issue #67 provides `readHistoryArtifacts`,
  `HistoryArtifactEligible`, `HistoryArtifactUnavailable`, and reader top-level
  reasons.
- Upstream: sub-issue #69 provides `computeComparableHistoryDelta` and
  `ComparableHistoryRunDelta`.
- Upstream: parent #60 provides available/unavailable `PrescriptionComparison`
  shapes and Run-level actuals.
- Upstream: parent #63 provides the existing `prescription_comparison` Output
  Profile section gate. This sub-issue must not add a new section ID.
- Downstream: the next sub-issue should render the attached `comparableHistory`
  block through Markdown and assert JSON/YAML structured output.
