# Parent Issue #60 -- Lap-aligned Prescription Comparison

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- The engine exposes a pure comparison entry point that accepts a matched
  Prescribed Run context, lap-derived `SegmentRow[]`, and `RunSummary`, then
  returns a structured `PrescriptionComparison` result.
- `AnalysisResult` gains optional `prescriptionComparison` data when a
  `prescribedRunContext` exists. If no Prescribed Run is associated, this parent
  leaves comparison absent rather than inventing an unrelated no-match section.
- Available comparison pairs `PrescribedRun.steps[n]` to `segments[n]` by order.
  No automatic interval detection, raw-record pattern matching, or fuzzy step
  matching is introduced.
- Missing usable lap-derived segments returns unavailable reason `missing_laps`
  and does not fabricate comparison rows.
- Prescribed Step count and actual Segment count must match exactly. A mismatch
  returns unavailable reason `step_count_mismatch` with both counts and no
  partial step comparisons.
- Completion evidence is reported per step. Distance targets compare prescribed
  kilometers to actual Segment meters; duration targets compare prescribed
  seconds to actual Segment duration. Each row includes actual value, prescribed
  value, delta, completion ratio, and completion status.
- Completion status uses asymmetric tolerance boundaries. Duration targets are
  `within_tolerance` from 5 seconds short through 10 seconds long. Distance
  targets are `within_tolerance` from 0.05 km short through 0.20 km long. Below
  the lower boundary is `short`; above the upper boundary is `long`.
- Power Target Range evidence is reported per step when both a Target Range and
  actual average power are present. The result labels the actual power as
  `below`, `within`, or `above` the range and includes deterministic deltas to
  the relevant bound.
- Steps without a Target Range or without actual average power keep structured
  unavailable power evidence for that step instead of looking up Zones or
  throwing.
- Available comparison includes factual actual evidence only: per-step average
  power, average heart rate, average pace, and run-level max heart rate and RPE
  when present. It does not emit coaching conclusions or readiness judgments.
- Lap-derived Segment rows required for comparison are computed even when the
  current config has no Zone definitions. Inline Target Ranges, not mutable Zone
  config, drive numeric power comparison.
- Existing Segment, Plan Context, and Prescribed Run association behavior
  remains intact for runs without Prescribed Runs and for runs without usable
  laps.
- This parent does not render Markdown/YAML/JSON prescription-comparison output,
  read saved history artifacts, choose YAML-vs-JSON history precedence, or
  compute prior-Run deltas.
- Structured tests cover available comparison, distance completion with
  asymmetric tolerance boundaries, duration completion with asymmetric tolerance
  boundaries, power below/within/above, missing actual power, missing Target
  Range, missing laps, step-count mismatch, run-level RPE present/absent, and
  `quantify` integration with a matched Prescribed Run.
- Repository-runnable verification commands succeed at parent closure, including
  `pnpm test` and `pnpm build`.

## Implementation approach

1. Add the public comparison result types beside existing engine output types.
   Keep the shape formatter-neutral and stable enough for downstream Markdown,
   YAML, JSON, and history work.
2. Implement a pure comparison helper that consumes already-associated
   `PrescribedRunContext`, `SegmentRow[]`, and `RunSummary`. Keep matching rules
   limited to ordered step-to-segment pairing.
3. Add tests for the pure helper before integrating with `quantify`. Cover
   available and unavailable results through structured assertions, not rendered
   prose.
4. Integrate the helper into `quantify` after Prescribed Run association and
   Segment computation. Ensure comparison can use lap-derived Segments even when
   Zone config is absent.
5. Attach `prescriptionComparison` to `AnalysisResult` only when the Run has an
   associated Prescribed Run. If association fails, preserve current behavior
   and leave final no-match messaging to downstream output design if needed.
6. Export only the comparison types and pure helper needed by tests and
   downstream parents. Do not add formatter helpers, history artifact readers,
   or new Plan fields.

This parent is expected to close in one vertical slice because the comparison
contract and `quantify` integration are tightly coupled: downstream formatter
and history parents need a real `AnalysisResult` field, not only an isolated
helper.

## Dependencies

- Upstream: parent #53 provides expanded `PrescribedRun.steps` with typed
  targets and optional Target Ranges.
- Upstream: parent #59 provides `prescribedRunContext` and the guarantee that a
  captured Run is associated with at most one Prescribed Run for comparison.
- Upstream: existing `computeSegments` turns FIT lap markers into `SegmentRow`
  values. This parent may adjust `quantify` to compute Segments without
  requiring Zone config, but must not change Segment boundaries away from FIT
  laps.
- Downstream: formatter output owns rendered Markdown/YAML/JSON exposure of the
  structured comparison.
- Downstream: comparable-history deltas own Analysis Artifact lookup,
  detailed-profile validation, key-case normalization, and same-basename
  ambiguity rules.
- External: no new persistence layer, database, cache, external service, config
  schema, zone-history subsystem, or workout-builder UI.
- Tooling: use repository-defined commands only. Existing `pnpm test` and
  `pnpm build` scripts are sufficient for parent closure unless this parent
  discovers a narrower package command already used by the repo.

## Flags

- This parent owns only the single-Run unavailable reasons `missing_laps` and
  `step_count_mismatch`. History reasons such as missing artifact, partial
  artifact, missing RPE in prior data, and YAML/JSON ambiguity remain
  downstream.
- Existing `SegmentRow` has `avgHeartRate` but not per-segment max heart rate.
  This parent records max heart rate at the Run level from `RunSummary` unless
  implementation proves a per-step max heart-rate field is necessary and keeps
  that extension localized to Segment computation and comparison tests.
- Do not treat a single lap as unavailable when the Prescribed Run has one
  Prescribed Step. Formatter profile rules that hide single-lap Segment tables
  do not control comparison availability.
- Do not infer power targets from `zone`, `avgPowerZone`, or current config.
  Only Prescribed Step Target Ranges are numeric comparison targets in this
  cycle.
- Completion tolerance is intentionally asymmetric in v1 to reflect normal lap
  execution drift: duration accepts `target - 5s` through `target + 10s`, and
  distance accepts `target - 50m` through `target + 200m`.
- If formatter integration becomes necessary to validate the result shape,
  create a follow-up parent or sub-issue rather than expanding this parent into
  rendered output and history work.
- [x] [61-implement-prescription-comparison](61-implement-prescription-comparison/sub-issue.md)

  Closed: implemented `PrescriptionComparison` engine types,
  `comparePrescriptionToSegments`, and `quantify` integration that attaches
  structured comparison results for matched Prescribed Runs.

  Implement the pure comparison helper, result types, and `quantify` integration
  that attaches structured single-Run Prescription Comparison data to
  `AnalysisResult`.
