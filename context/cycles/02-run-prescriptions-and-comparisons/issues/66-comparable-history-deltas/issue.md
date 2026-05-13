# Parent Issue #66 -- Comparable-History Deltas

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- The engine exposes a pure history lookup entry point that accepts a Block
  directory path, the current Run's FIT basename, and the current Run's
  Comparison Group, then returns a structured list of eligible prior Analysis
  Artifact descriptors with status, source path, format, and parsed Run-level
  actual evidence.
- A YAML or JSON file is treated as an Analysis Artifact only when its basename
  matches a sibling `.fit` File in the same Block directory and its parsed
  content carries the structured sections required for the requested comparison.
- YAML and JSON Analysis Artifacts are normalized to a single internal shape
  before eligibility checks. Key-case normalization reuses
  `transformKeysCamelToSnake` or its inverse; no second case-conversion seam is
  introduced.
- The Detailed-Profile eligibility rule is defined by data presence, not by a
  recorded profile name. An artifact is eligible only when its normalized
  content includes the Run-level fields required for at least one supported
  delta metric (avg power, avg heart rate, max heart rate, avg pace, RPE).
- Artifacts that parse but lack required fields produce structured unavailable
  descriptors with reason `partial_artifact` and the list of missing fields.
- Artifacts that fail to parse produce structured unavailable descriptors with
  reason `unparseable_artifact` and the underlying error message.
- Same-basename YAML and JSON pairs are resolved deterministically. The
  implementation chooses one rule (prefer YAML, prefer JSON, or reject both as
  `ambiguous_artifact`) and the choice is recorded as a flag with a one-line
  justification in this issue before the parent closes.
- The engine exposes a pure comparable-history delta computation that consumes
  the current Run's Prescription Comparison actuals and an eligible prior
  artifact descriptor, then returns deterministic deltas for avg power, avg
  heart rate, max heart rate, avg pace, and RPE when both sides have the source
  field. Missing fields on either side produce per-metric unavailable reasons
  rather than zeroed or fabricated deltas.
- `AnalysisResult.prescriptionComparison` gains a structured `comparableHistory`
  block on the `available` state that lists prior Runs in the same Comparison
  Group, each with its source artifact path, captured date, per-metric deltas,
  and per-metric unavailable reasons. The single-Run `unavailable` state remains
  unchanged.
- History lookup never runs for Prescribed Runs without a Comparison Group. The
  current Run's `prescription_comparison` section continues to render exactly as
  parent #63 produces it when no Comparison Group is present.
- History lookup never runs for the current Run's own Analysis Artifact even
  when the FIT file's prior output is sitting in the same Block directory. The
  current FIT basename is excluded from the candidate set.
- The Markdown formatter extends the `Prescription Comparison` section with a
  factual comparable-history subsection when at least one eligible prior
  artifact exists. It lists each prior Run with date, source file, and the
  deltas computed by the engine. Per-metric unavailable reasons are shown inline
  rather than hidden.
- The Markdown formatter renders a short unavailable line when the Prescribed
  Run has a Comparison Group but no eligible prior artifact exists, naming the
  reason (no candidates, all candidates partial, ambiguity, parse failures).
- JSON output includes `comparableHistory` under `prescriptionComparison` with
  the structured per-prior shape. YAML output includes `comparable_history`
  under `prescription_comparison` after the existing snake-case conversion.
- The Output Profile section name remains `prescription_comparison`. No new
  section ID, no new CLI flag, no new config field, no new Plan schema field,
  and no new persistence layer is introduced.
- Comparable-history lookup does not re-run Prescribed Run association, reparse
  Prescription Notation, recompute Segments, infer lap boundaries, or look up
  current Zone values.
- Structured tests cover Analysis Artifact discovery, same-basename YAML/JSON
  resolution, detailed-profile eligibility, partial-artifact reasons,
  unparseable-artifact reasons, Comparison Group filtering, current-artifact
  exclusion, delta computation for each supported metric, missing-field
  per-metric reasons, integration through `quantify`, and Markdown/JSON/YAML
  formatter output.
- Repository-runnable verification commands succeed at parent closure, including
  `pnpm test` and `pnpm build`.

## Implementation approach

1. Define the history Analysis Artifact descriptor types beside existing
   `PrescriptionComparison` types. Keep the descriptor shape independent of the
   on-disk format so YAML and JSON callers share one downstream contract.
2. Implement the pure history reader in `packages/engine/src/plan/` (or a new
   `history/` directory if file separation reads better). The reader takes a
   directory path, the current Run's FIT basename, and the current Comparison
   Group, and returns descriptors plus a top-level unavailable reason when
   appropriate. Tests use fixture directories with hand-authored YAML/JSON
   files; no FIT parsing is required for reader tests.
3. Resolve the same-basename YAML/JSON precedence rule during sub-issue #67
   design. Record the chosen rule in this issue's Flags before the parent
   closes.
4. Implement comparable-history delta computation as a separate pure helper that
   consumes Prescription Comparison actuals and one prior descriptor. Keep delta
   direction defined once (current minus prior) and reuse it across metrics.
5. Integrate the reader and delta helper into `quantify` after Prescribed Run
   association and Prescription Comparison computation. The integration must
   only fire when `prescribedRunContext.comparisonGroup` is present and the Run
   has the FIT directory information needed to scan siblings.
6. Extend the formatter to render the new structured field. Reuse the
   `prescription_comparison` Output Profile section gate from parent #63 so
   profile exclusion still hides everything.
7. Add tests in red-green order for each surface: reader, delta helper,
   `quantify` integration, and three formatter outputs.

This parent is expected to split into more than one sub-issue because the reader
has its own design-it-twice choice for ambiguity rules and is exercised
primarily through fixture directories, while the delta computation plus
integration plus formatter work depends on the reader being closed first.

## Dependencies

- Upstream: parent #53 provides Prescribed Runs with optional Comparison Group
  authoring.
- Upstream: parent #59 provides `prescribedRunContext` with `comparisonGroup` on
  `AnalysisResult` when association succeeds, and `scanBlockRuns` plus the
  Block-directory convention for sibling files.
- Upstream: parent #60 provides `AnalysisResult.prescriptionComparison`
  available and unavailable states with structured actuals usable as the current
  side of every delta.
- Upstream: parent #63 exposes `prescription_comparison` through Markdown, JSON,
  and YAML formatters. This parent extends the section payload without changing
  the section ID, the profile vocabulary, or the existing available/unavailable
  shapes.
- Upstream: existing `transformKeysCamelToSnake` is the only sanctioned key case
  helper. Reusing it (or its inverse) is required; no second case- conversion
  utility is introduced.
- External: no new persistence database, cache, external service, Plan schema
  change, FIT parsing change, Zone subsystem change, or CLI flag.
- Tooling: use repository-defined commands only. Existing `pnpm test` and
  `pnpm build` scripts are sufficient for parent closure.

## Flags

- **RESOLVED by sub-issue #67:** same-basename YAML/JSON precedence uses
  `reject_ambiguous`. When both formats exist for one basename, the reader emits
  one `ambiguous_artifact` descriptor so history deltas never guess between two
  competing sources of truth.
- **RESOLVED by sub-issue #67:** Detailed-Profile eligibility is data-presence
  based and requires `capturedDate`, `comparisonGroup`, and at least one of
  `avgPower`, `avgHeartRate`, `maxHeartRate`, `avgPace`, or `rpe`. Missing
  required fields are surfaced as `partial_artifact` with explicit
  `missingFields`.
- Comparable-history lookup must remain inert when the Prescribed Run has no
  Comparison Group. This parent does not introduce implicit grouping by
  Prescribed Run label or by Week Type.
- Comparable-history lookup must not depend on the current Run's saved Analysis
  Artifact existing yet. The reader excludes the current FIT basename from the
  candidate set explicitly, not by relying on the artifact being absent.
- Markdown output must not invent missing values. A missing-prior-RPE delta
  remains an explicit per-metric unavailable line; it does not silently drop the
  row or substitute zero.
- The cycle PRD non-goal "No arbitrary partial-output history. A prior artifact
  must contain the data required for the requested comparison." remains
  enforced. Per-metric eligibility is the gate; a partial artifact is surfaced
  as a labeled unavailable reason, not as a zero-delta row.
- If the rendered comparable-history shape needs more than the current Markdown
  row plus structured per-metric blocks, do not expand this parent into a
  presentation model. Open a follow-up parent for richer history presentation.

## Sub-issues

- [x] [67-history-artifact-reader](67-history-artifact-reader/sub-issue.md)

  Implement the pure history Analysis Artifact reader: discovery within a Block
  directory, YAML/JSON parsing and key-case normalization, same-basename
  precedence, Detailed-Profile eligibility, Comparison Group filtering,
  current-artifact exclusion, and structured per-candidate descriptors usable by
  later delta computation. No `quantify` integration, no formatter changes, no
  delta computation in this sub-issue.

- [x] [68-comparable-history-delta-computation](68-comparable-history-delta-computation/sub-issue.md)

  Implement the pure Comparable-History Delta computation: consume current
  Prescription Comparison actuals and one eligible prior history artifact,
  compute `current - prior` deltas for avg power, avg heart rate, max heart
  rate, avg pace, and RPE, and return per-metric unavailable reasons when either
  side lacks a value. No history reader change, no `quantify` integration, no
  `AnalysisResult` field change, and no formatter changes in this sub-issue.
