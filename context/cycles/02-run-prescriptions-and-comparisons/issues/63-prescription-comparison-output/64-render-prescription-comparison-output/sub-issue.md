# Sub-Issue #64 -- Render Prescription Comparison Output

Vertical slice for parent #63. Delivers the formatter section, profile handling,
and Markdown/JSON/YAML exposure for `AnalysisResult.prescriptionComparison`.

## Description

Add `prescription_comparison` as an Output Profile section and render existing
single-Run Prescription Comparison data in every supported output format. JSON
and YAML should preserve the engine's structured comparison contract so tests
and future history lookup can consume it directly. Markdown should present the
same evidence in a runner-readable section without adding coaching conclusions.

Out of scope: comparable-history lookup, prior-Run deltas, detailed-profile
artifact validation, YAML-vs-JSON history precedence, FIT lap comparison logic,
Plan schema changes, and new CLI flags.

## Dependency classification

| Dependency                                                                 | Category   | Testing strategy                                                                                                                    |
| -------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `AnalysisResult.prescriptionComparison` and `PrescriptionComparison` types | In-process | Build typed formatter fixtures with available and unavailable comparisons; assert formatter output preserves the contract.          |
| Output Profile section filtering                                           | In-process | Call `formatResult` with default, explicit include, and explicit exclude profiles; assert section visibility follows profile state. |
| Config schema section validation                                           | In-process | Parse config fixtures containing `prescription_comparison` under default and detailed profiles.                                     |
| Markdown formatter                                                         | In-process | Assert factual headings, context, unavailable reasons, and representative row evidence from small fixtures.                         |
| JSON and YAML formatters                                                   | In-process | Parse formatter output back into objects and assert structured fields instead of comparing prose.                                   |
| Existing Segment and column filtering                                      | In-process | Use formatter tests to assert `skipSegmentsIfSingleLap` and active columns do not remove or mutate Prescription Comparison.         |

No local-substitutable, remote-owned, collaborator-owned, true external, or
irreplaceable dependency is introduced. No port is needed because formatting is
an in-process transformation over `AnalysisResult` data with no alternate
adapter boundary.

## Interface design

The interface this sub-issue commits to is the formatter-facing section contract
for Prescription Comparison.

### Design-it-twice

**Alternative A -- Minimal section pass-through**

Add `prescription_comparison` to the section vocabulary. When active, pass
`AnalysisResult.prescriptionComparison` through the existing filtered result and
let each formatter render it.

```ts
export type SectionId = ExistingSectionId | "prescription_comparison";

formatResult(result, format, {
  sections: ["summary", "prescription_comparison"],
  columns: "all",
});
```

- Leverage: high -- the existing profile and formatter dispatch seams do the
  routing with one new section.
- Locality: high -- changes stay in formatter types, config schema, formatter
  filtering, and formatter tests.
- Testability: high -- fixture AnalysisResults can exercise all output states
  without FIT files or Plan parsing.

**Alternative B -- Common-caller always-on comparison output**

Forward `prescriptionComparison` whenever it exists, similar to current Plan
Context forwarding, and do not add a profile section.

```ts
interface FilteredResult {
  planContext?: PlanContext;
  prescriptionComparison?: PrescriptionComparison;
}
```

- Leverage: medium -- default runner output is simple and hard to misconfigure.
- Locality: high -- it avoids config-schema changes.
- Testability: medium -- tests are simple, but future detailed-artifact checks
  cannot distinguish intentional section inclusion from always-on metadata.

**Alternative C -- Strongest runner encounter presentation model**

Create a dedicated presentation model that groups warmup, work reps, recoveries,
and cooldowns, summarizes only the most important rows in Markdown, and emits a
separate normalized JSON/YAML shape optimized for repeated-session review.

```ts
export interface PrescriptionComparisonPresentation {
  heading: string;
  status: "available" | "unavailable";
  summaryRows: PrescriptionComparisonSummaryRow[];
  stepRows: PrescriptionComparisonDisplayRow[];
}
```

- Leverage: medium -- Markdown could be more polished for repeated interval
  review.
- Locality: low -- a second comparison shape risks drifting from the engine
  contract and history artifact needs.
- Testability: medium -- presentation tests would grow separately from
  structured comparison tests.

### Choice

**A (minimal section pass-through).** It exposes the existing structured
Prescription Comparison through the established Output Profile seam with the
smallest new surface.

B is rejected in one sentence: always-on output bypasses the Output Profile term
and makes future detailed-artifact eligibility harder to reason about. C is
rejected in one sentence: a presentation model would duplicate the comparison
contract before history work proves a second shape is needed.

### Public interface

Entry point:

```ts
formatResult(result, format, profile);
```

Inputs:

- `result.prescriptionComparison`: optional `PrescriptionComparison` from parent
  #60.
- `profile.sections`: optional `SectionId[]` that may include
  `prescription_comparison`.
- `format`: existing `"markdown" | "json" | "yaml"` output selector.

Outputs:

- Markdown includes a `Prescription Comparison` section only when
  `prescription_comparison` is active and `result.prescriptionComparison`
  exists.
- JSON includes `prescriptionComparison` only when active and present.
- YAML includes `prescription_comparison` only when active and present.
- Formatter warnings continue to report only existing profile and capability
  warnings unless an existing code path already produces one.

Invariants:

- The formatter does not mutate `AnalysisResult.prescriptionComparison`.
- The formatter does not re-associate a Run, reparse Prescription Notation,
  recompute Segments, or derive Target Ranges from Zones.
- Available and unavailable comparison status values are preserved exactly.
- JSON keeps camelCase keys because current JSON formatter output is camelCase.
- YAML keeps snake_case keys because current YAML formatter output applies
  `camelToSnake`.
- Column filtering affects Segment and Km Split rows, not Prescription
  Comparison evidence.
- `skipSegmentsIfSingleLap` affects only the Segment section, not Prescription
  Comparison visibility.

Error modes:

- Missing `result.prescriptionComparison` produces no section and no warning.
- An excluded `prescription_comparison` section produces no section and no
  warning.
- Unknown section IDs remain config-schema validation failures through the
  existing config parser.

## Acceptance criteria

- `SectionId`, config `SECTION_IDS`, and `DEFAULT_PROFILE.sections` include
  `prescription_comparison`.
- `applyProfile` forwards `prescriptionComparison` only when the section is
  active and present on `AnalysisResult`.
- Markdown output renders available Prescription Comparison data with a heading,
  Prescribed Run label/date, match kind, optional Comparison Group, run-level
  actual evidence, and one row per step.
- Markdown step rows include Prescribed Step index/source, target kind, actual
  completion value, delta, completion status, power status, and available heart
  rate/pace evidence.
- Markdown output renders unavailable Prescription Comparison data with heading,
  Prescribed Run label/date, reason, prescribed step count, and actual Segment
  count.
- JSON output includes `prescriptionComparison` for available and unavailable
  fixture results when the section is active.
- YAML output includes `prescription_comparison` for available and unavailable
  fixture results when the section is active.
- Runs without `prescriptionComparison` omit the section in Markdown, JSON, and
  YAML without warnings.
- Profiles that exclude `prescription_comparison` omit the section even when the
  result has comparison data.
- Existing Segment, Km Split, Plan Context, capability warning, and column
  filtering behavior remains unchanged except for expected snapshots that now
  include the default section when comparison data exists.
- No history artifact reader, prior-Run delta computation, Plan parser change,
  FIT parser change, or new CLI option is introduced.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and `pnpm build`.

## Proposed tests

1. **Config accepts section** -- parsing config with `prescription_comparison`
   in `output.default.sections` and `output.detailed.sections` succeeds.
2. **Default profile includes section** -- formatting a result with comparison
   data and `DEFAULT_PROFILE` emits the section.
3. **Profile exclusion hides section** -- formatting with
   `sections: ["summary"]` omits comparison data in Markdown, JSON, and YAML.
4. **Absent comparison omits section** -- a normal AnalysisResult without
   `prescriptionComparison` emits no empty comparison block and no warning.
5. **JSON available shape** -- JSON output for an available comparison contains
   `prescriptionComparison.status`, `prescribedRun`, `actual`, and `steps`.
6. **JSON unavailable shape** -- JSON output for an unavailable comparison
   contains `reason`, `prescribedStepCount`, and `actualSegmentCount`.
7. **YAML available shape** -- YAML output for an available comparison contains
   `prescription_comparison.status`, `prescribed_run`, `actual`, and `steps`.
8. **YAML unavailable shape** -- YAML output for an unavailable comparison
   contains `reason`, `prescribed_step_count`, and `actual_segment_count`.
9. **Markdown available section** -- Markdown output includes the heading,
   Prescribed Run context, run-level actuals, and representative step evidence.
10. **Markdown unavailable section** -- Markdown output includes the heading,
    unavailable reason and counts, and no fabricated step table.
11. **Single-lap skip isolation** -- `skipSegmentsIfSingleLap` may skip the
    Segment section but does not hide Prescription Comparison.
12. **Column filtering isolation** -- active columns do not remove completion or
    power evidence from Prescription Comparison rows.

## Affected artifacts

- `packages/engine/src/types.ts`
- `packages/engine/src/config/schema.ts`
- `packages/engine/src/config/schema.test.ts`
- `packages/engine/src/formatters/index.ts`
- `packages/engine/src/formatters/markdown.ts`
- `packages/engine/src/formatters/json.ts`
- `packages/engine/src/formatters/yaml.ts`
- `packages/engine/src/formatters/index.test.ts`
- Existing formatter snapshots or fixture helpers, if any test output changes
  because `DEFAULT_PROFILE` now includes `prescription_comparison`.

## Dependencies

- Parent #60 must remain closed because this sub-issue consumes its
  `PrescriptionComparison` contract without changing comparison semantics.
- Existing formatter profile filtering must remain the only section-gating seam.
- Future comparable-history work depends on this sub-issue exposing structured
  YAML/JSON comparison data but is not implemented here.
