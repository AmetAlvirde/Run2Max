# Sub-Issue #70 -- Comparable-History Formatter Output

Vertical slice for parent #66. Delivers Markdown rendering plus JSON/YAML
serialization coverage for the `comparableHistory` block already attached to an
available `prescriptionComparison` by sub-issue #69. No history lookup, no delta
arithmetic, no `quantify` integration, no new Output Profile section, and no
presentation model happen in this sub-issue.

## Description

Extend the existing `prescription_comparison` formatter surface so comparable
history is visible wherever the parent promises output: Markdown shows a factual
Comparable History subsection, JSON includes the existing camelCase
`comparableHistory` structure under `prescriptionComparison`, and YAML includes
the same structure after the existing snake-case conversion as
`comparable_history` under `prescription_comparison`.

The Markdown output must preserve the engine's structured semantics. Available
prior Runs are listed with captured date, source artifact path, and per-metric
results. Unavailable metric values are rendered inline with their explicit
reason. When lookup ran but no eligible prior artifact exists, Markdown renders
a short unavailable line naming the top-level reason and, when present, the
candidate reasons already attached by `quantify`.

Out of scope: changing `readHistoryArtifacts`, changing
`computeComparableHistoryDelta`, changing the `ComparableHistory` result shape,
running history lookup from formatters, adding CLI flags, changing Output
Profile IDs, introducing a richer presentation model, changing JSON field names,
or changing YAML case-conversion behavior.

## Dependency classification

| Dependency                                                                            | Category   | Testing strategy                                                                                                                              |
| ------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `PrescriptionComparisonAvailable.comparableHistory` from sub-issue #69                | In-process | Formatter tests pass literal `AnalysisResult` objects with available and unavailable comparable-history blocks; no `quantify` call is needed. |
| `ComparableHistoryRunDelta` and per-metric unavailable descriptors from sub-issue #68 | In-process | Markdown tests assert each supported metric is rendered from the structured metric array, including unavailable reasons.                      |
| `formatMarkdown` existing `prescription_comparison` section renderer                  | In-process | Existing profile-gated formatter tests assert the subsection appears only when the `prescription_comparison` section is active.               |
| `formatJson` structured serializer                                                    | In-process | JSON tests parse output and assert `prescriptionComparison.comparableHistory` is preserved without renaming or flattening.                    |
| `formatYaml` and existing `camelToSnake` conversion                                   | In-process | YAML tests parse output and assert `prescription_comparison.comparable_history` exists with nested snake_case metric fields.                  |
| Markdown table/value helpers (`fmtPower`, `fmtHR`, `fmtPace`)                         | In-process | Markdown expectations assert existing display units for comparable-history metric values instead of new formatter utilities.                  |

No local-substitutable, remote-owned, collaborator-owned, true external, or
irreplaceable dependency is introduced. Formatters are pure in-process functions
over an already-computed `AnalysisResult`.

No port is needed. A formatter adapter seam would have only one production
implementation per output format, and JSON/YAML already use direct serializers
behind the existing `formatResult` entry point.

## Interface design

The interface this sub-issue commits to is the existing formatter entry point
and the rendered/serialized shape of `prescriptionComparison.comparableHistory`.

### Design-it-twice

**Alternative A -- Extend the existing prescription comparison renderer**

Markdown appends a small Comparable History subsection inside
`renderPrescriptionComparison` when `comparison.status === "available"` and
`comparison.comparableHistory` is present. JSON and YAML continue to serialize
the `AnalysisResult` shape through their current section-gated paths.

```ts
function renderPrescriptionComparison(result: FilteredResult): string;
```

- Leverage: high -- uses the established `prescription_comparison` section and
  the block attached by `quantify` without adding another public seam.
- Locality: high -- all user-facing Markdown wording for Prescription Comparison
  stays in one renderer.
- Testability: high -- formatter tests can pass literal result objects and
  assert Markdown/JSON/YAML output directly.

**Alternative B -- Add a formatter-local presentation model**

Create a formatter helper that transforms `ComparableHistory` into a separate
presentation object before Markdown, JSON, and YAML rendering.

```ts
function buildComparableHistoryPresentation(
  history: ComparableHistory,
): ComparableHistoryPresentation;
```

- Leverage: medium -- could centralize labels, but only Markdown needs human
  labels while JSON/YAML should preserve structured engine output.
- Locality: medium -- introduces a second shape between engine output and
  formatter output for one subsection.
- Testability: medium -- tests would need to cover both the presentation object
  and the final output without a second caller.

**Alternative C -- Create a new output section**

Add a `comparable_history` Output Profile section rendered separately from
`prescription_comparison`.

```ts
type SectionId = "prescription_comparison" | "comparable_history" | ...;
```

- Leverage: low -- users would have to opt into another section to see data that
  belongs to Prescription Comparison.
- Locality: low -- splits one domain concept across two profile gates.
- Testability: low -- broadens config/schema/default-profile expectations for a
  parent that explicitly forbids a new section ID.

### Choice

**A (extend the existing prescription comparison renderer).** It keeps the
Comparable-History output under the existing `prescription_comparison` section,
preserves JSON/YAML structured payloads, and avoids a presentation model before
a second presentation need exists.

B is rejected in one sentence: a presentation model would duplicate the engine
shape for Markdown-only labels while JSON/YAML need the original structure. C is
rejected in one sentence: a new section ID violates the parent constraint and
would make Comparable History independently toggleable from its owning
Prescription Comparison context.

### Public interface

Entry point:

```ts
export function formatResult(
  result: AnalysisResult,
  format: OutputFormat,
  profile?: OutputProfile,
): string;
```

Inputs:

- `AnalysisResult.prescriptionComparison.status === "available"` with optional
  `comparableHistory` from sub-issue #69.
- Existing Output Profile sections. The only section gate used here is
  `prescription_comparison`.

Outputs:

- Markdown: the existing `## Prescription Comparison` section remains the owner.
  When `comparableHistory.status === "available"`, append a `Comparable History`
  subsection listing each prior Run with captured date, source artifact path,
  and stable metric rows. Available metrics show current, prior, and
  `current - prior` delta. Unavailable metrics show the explicit reason inline.
- Markdown: when `comparableHistory.status === "unavailable"`, append a short
  unavailable line naming `no_candidates` or `all_candidates_unavailable`. If
  candidate descriptors are present, include their candidate reasons without
  inventing missing values.
- JSON: parsed output contains `prescriptionComparison.comparableHistory`
  exactly as present on the filtered result.
- YAML: parsed output contains `prescription_comparison.comparable_history`
  after the existing recursive snake-case conversion.

Invariants:

- Formatters never call `readHistoryArtifacts`, `computeComparableHistoryDelta`,
  `quantify`, FIT parsing, Plan loading, or the filesystem.
- Missing metric values remain explicit unavailable metric rows; Markdown must
  not omit them, substitute zero, or collapse them into the run summary.
- Existing single-Run Prescription Comparison lines and step table remain
  unchanged when `comparableHistory` is absent.
- `PrescriptionComparisonUnavailable` rendering remains unchanged and never
  renders comparable history.
- The Output Profile section ID remains `prescription_comparison`; no profile,
  config schema, CLI flag, or Plan schema change is introduced.
- YAML case conversion continues to use the existing recursive `camelToSnake`
  path; no second case-conversion seam is introduced.

Error modes:

- Unknown future metric names are rendered by their raw metric identifier rather
  than throwing, if TypeScript widening ever permits them. The current typed
  metric union should cover all parent #66 metrics.
- An available comparable-history block with an empty `runs` array is rendered
  as unavailable text rather than a blank subsection, but this is a defensive
  formatter fallback; sub-issue #69 should normally attach `unavailable` in that
  case.
- Candidate diagnostic details are rendered only from fields already present on
  `HistoryArtifactUnavailable`; formatters do not derive or recompute reasons.

## Acceptance criteria

- Markdown output for an available `prescriptionComparison` with available
  `comparableHistory` includes a Comparable History subsection under the
  existing `## Prescription Comparison` section.
- Each available prior Run in Markdown includes captured date, source artifact
  path, and per-metric rows for avg power, avg heart rate, max heart rate, avg
  pace, and RPE in the stable delta-helper order.
- Available metric rows show current value, prior value, and signed delta using
  existing unit helpers where applicable.
- Unavailable metric rows are shown inline with their explicit reason; missing
  prior RPE is not dropped or rendered as zero.
- Markdown output for unavailable `comparableHistory` renders a concise line
  that names `no_candidates` or `all_candidates_unavailable` and includes
  candidate reasons when candidates exist.
- Markdown output is unchanged for available `prescriptionComparison` results
  that do not carry `comparableHistory`.
- Markdown output is unchanged for `PrescriptionComparisonUnavailable` results.
- JSON output includes `comparableHistory` under `prescriptionComparison` when
  present and continues to omit the whole section when the Output Profile
  excludes `prescription_comparison`.
- YAML output includes `comparable_history` under `prescription_comparison` when
  present and continues to omit the whole section when the Output Profile
  excludes `prescription_comparison`.
- No formatter performs filesystem I/O, history lookup, delta computation,
  Prescribed Run association, Prescription Notation parsing, Segment
  computation, or Zone lookup.

## Proposed tests

- Add a Markdown formatter test with available comparable history containing one
  prior Run and all available metrics. Assert the subsection includes the prior
  date, source file, current/prior values, and signed deltas.
- Add a Markdown formatter test with an unavailable metric such as missing prior
  RPE. Assert the row is present with `missing_prior_value` and no zero value is
  invented.
- Add a Markdown formatter test with
  `comparableHistory.status === "unavailable"` and candidate descriptors. Assert
  the rendered line names the top-level reason and candidate reasons.
- Add a regression test that an available `prescriptionComparison` without
  `comparableHistory` renders exactly as the existing parent #63 expectation.
- Add a regression test that `PrescriptionComparisonUnavailable` rendering is
  unchanged and does not mention Comparable History.
- Add JSON formatter tests that parsed output preserves
  `prescriptionComparison.comparableHistory` for available and unavailable
  comparable-history blocks.
- Add YAML formatter tests that parsed output exposes
  `prescription_comparison.comparable_history`, including nested snake_case
  fields such as `source_path`, `captured_date`, and `missing_prior_value`.
- Add profile-gating tests, or extend existing ones, to assert JSON/YAML and
  Markdown omit comparable history whenever `prescription_comparison` is not an
  active section.

## Affected artifacts

- `packages/engine/src/formatters/markdown.ts`
- `packages/engine/src/formatters/json.ts` only if a regression fix is needed;
  the expected implementation path is test coverage over existing passthrough.
- `packages/engine/src/formatters/yaml.ts` only if a regression fix is needed;
  the expected implementation path is test coverage over existing snake-case
  passthrough.
- `packages/engine/src/formatters/index.test.ts`
- `packages/engine/src/types.ts` only if the closed sub-issue #69 shape needs a
  naming adjustment discovered during formatter tests; avoid type changes by
  default.

## Dependencies

- Upstream: sub-issue #67 provides unavailable candidate reasons surfaced
  through `HistoryArtifactUnavailable` when no eligible prior artifacts exist.
- Upstream: sub-issue #68 provides `ComparableHistoryRunDelta` metric order,
  delta direction, and missing-value reasons.
- Upstream: sub-issue #69 attaches `ComparableHistory` to available
  `PrescriptionComparison` results and preserves unavailable candidate
  descriptors for formatter use.
- Upstream: parent #63 provides the existing `prescription_comparison` Output
  Profile section and Markdown/JSON/YAML formatter entry points.
- Downstream: parent #66 closure should run the repository verification
  commands, including `pnpm test` and `pnpm build`, after this formatter slice
  is implemented.
