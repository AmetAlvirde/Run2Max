# Parent Issue #63 -- Prescription Comparison Output

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- The formatter layer treats Prescription Comparison as an Output Profile
  section named `prescription_comparison`.
- The default Output Profile includes `prescription_comparison` so a matched
  Prescribed Run appears in normal Markdown, JSON, and YAML output without a
  custom profile.
- Config parsing accepts `prescription_comparison` in `output.default.sections`
  and `output.detailed.sections`.
- Profile filtering forwards `AnalysisResult.prescriptionComparison` only when
  the section is active and the result has comparison data. Runs without an
  associated Prescribed Run continue to omit the section.
- JSON output exposes the structured comparison as `prescriptionComparison` and
  preserves the available and unavailable result shapes from the engine
  contract.
- YAML output exposes the structured comparison as `prescription_comparison` and
  preserves the same data after the existing snake-case conversion.
- Markdown output renders a factual `Prescription Comparison` section for
  available comparisons with the Prescribed Run label/date, match kind,
  Comparison Group when present, run-level actual evidence, and per-step
  prescribed-vs-actual completion and power evidence.
- Markdown output renders unavailable comparisons with the Prescribed Run
  label/date, reason, prescribed step count, and actual Segment count. It does
  not fabricate partial rows for `missing_laps` or `step_count_mismatch`.
- Formatter output does not re-run Prescribed Run association, reparse
  Prescription Notation, recompute Segments, infer lap boundaries, or look up
  current Zone values for Target Ranges.
- Existing profile behavior remains intact: `skipSegmentsIfSingleLap` affects
  only the Segment section, column filtering affects Segment and Km Split rows,
  and Plan Context remains forwarded according to existing rules.
- Structured formatter tests cover JSON and YAML available output, JSON and YAML
  unavailable output, Markdown available output, Markdown unavailable output,
  section exclusion, default-profile inclusion, absent comparison data, and
  config schema acceptance of `prescription_comparison`.
- Repository-runnable verification commands succeed at parent closure, including
  `pnpm test` and `pnpm build`.

## Implementation approach

1. Extend the formatter section vocabulary with `prescription_comparison` in the
   engine `SectionId` type, config schema, default profile, and formatter
   section dispatch.
2. Add `prescriptionComparison` to the filtered formatter result only when the
   profile includes `prescription_comparison` and `AnalysisResult` carries the
   field.
3. Emit the existing structured `PrescriptionComparison` object in JSON and YAML
   without deriving a second shape. Let the existing YAML key-case conversion
   produce `prescription_comparison` and snake-case nested keys.
4. Add a Markdown renderer that presents available comparison evidence as
   factual rows and unavailable comparison as a short status block. Keep prose
   stable but do not make Markdown the only assertion surface.
5. Add formatter and config-schema tests before implementation. Prefer small
   typed `AnalysisResult` fixtures over FIT fixtures because parent #60 already
   tested `quantify` integration.
6. Avoid history artifact readers, prior-Run lookup, same-basename artifact
   rules, and detailed-profile eligibility checks. Those belong to the next
   history parent after output exposure is closed.

This parent is expected to close in one vertical slice because the section ID,
profile filtering, and three formatter outputs must agree for the Analysis
Artifact surface to be useful downstream.

## Dependencies

- Upstream: parent #60 provides the `PrescriptionComparison` contract and
  attaches it to `AnalysisResult` when a Prescribed Run comparison exists.
- Upstream: existing formatter separation provides `formatResult`, Markdown,
  JSON, YAML, profile filtering, and config-schema section validation.
- Downstream: comparable-history deltas consume saved detailed YAML/JSON
  Analysis Artifacts and decide detailed-profile eligibility, key-case
  normalization, missing/partial artifact reasons, and YAML-vs-JSON ambiguity
  behavior.
- External: no new persistence layer, database, cache, external service, Plan
  schema change, FIT parsing change, Zone subsystem change, or CLI flag.
- Tooling: use repository-defined commands only. Existing `pnpm test` and
  `pnpm build` scripts are sufficient for parent closure.

## Flags

- This parent exposes current single-Run Prescription Comparison only. It does
  not produce prior-Run deltas or read historical Analysis Artifacts.
- The Output Profile section name is `prescription_comparison` to match existing
  snake-case section IDs such as `km_splits`, `hr_zones`, and `pace_zones`.
- JSON keeps the repository's existing camelCase output convention; YAML keeps
  the existing snake_case conversion convention.
- `skipSegmentsIfSingleLap` must not hide Prescription Comparison. A one-step
  comparison remains visible even if the Segment table is skipped.
- The cycle PRD's detailed-profile validation question remains open for the
  history parent. This parent only ensures the structured section can exist in
  YAML/JSON Analysis Artifacts.
- [x] [64-render-prescription-comparison-output](64-render-prescription-comparison-output/sub-issue.md) -- closed with formatter/profile/config updates, tests, and `pnpm test` + `pnpm build` passing.

  Render `AnalysisResult.prescriptionComparison` through Markdown, JSON, and
  YAML formatters behind the `prescription_comparison` Output Profile section.
