# Cycle 02 — Run Prescriptions and Comparisons

> High-level PRD for the next user-facing feature cycle. Sub-PRDs and parent
> issues will live in this cycle's folder alongside this document.
>
> Status: draft.

## Focus

Make the Plan concrete enough to compare a captured Run against the
Block-specific Prescribed Run the athlete intended to execute, including
lap-aligned Prescribed Steps, inline Target Ranges, and factual deltas against
prior Runs in the same Comparison Group.

## Intentions

- Move Run2Max from Week-level context toward Run-level prescription evidence
  without becoming a coaching inference engine.
- Keep the Plan as the runner-owned source of truth while preserving existing
  Plans as valid inputs.
- Let the athlete keep authoring compact Prescription Notation instead of
  maintaining verbose expanded step lists by hand.
- Prefer reproducible comparison targets over mutable zone lookups when a
  Prescribed Step needs numeric evaluation.
- Build on the cycle 01 engine seams: Plan walking, Plan Context, split
  aggregation, and formatter separation.

## Goals

- `plan.yaml` supports optional `prescribed_runs` under each Week without a
  schema-version bump.
- A Prescribed Run can carry a local day/date, label, Prescription Notation,
  optional Comparison Group, and enough metadata to be matched from `quantify`.
- Prescription Notation parses a narrow v1 grammar: ordered steps separated by
  `->` or `→`, repetition groups such as `4(...)`, `/` between repeated
  work/recovery steps, distance targets such as `1.6K`, duration targets such as
  `3min`, intensity labels after `@`, and inline Target Ranges such as
  `[205-234W]`.
- Prescribed Runs expand into ordered Prescribed Steps covering the full
  lap-aligned sequence: warmup, reps, recoveries, cooldowns, and any other
  authored step.
- `run2max quantify <fit>` associates the Run to a Prescribed Run by local date
  by default, with an explicit override for moved or ambiguous Runs.
- When FIT lap markers are available, Run2Max compares actual Segment rows to
  Prescribed Steps by order and marks comparison unavailable when usable laps
  are missing or incompatible.
- The single-Run comparison reports deterministic evidence: completion against
  prescribed duration/distance, avg power against Target Range, avg/max heart
  rate, avg pace, and run-level RPE when present.
- Comparable-history deltas use prior detailed YAML/JSON AnalysisResult
  artifacts with the same basename as their FIT File and the same Comparison
  Group.
- YAML and JSON history artifacts are treated as equivalent after key-case
  normalization, but only detailed-profile artifacts with required sections and
  columns are eligible for comparison.
- Markdown, JSON, and YAML outputs expose the prescription comparison without
  making rendered prose the only testable surface.

## Non-goals

- No automatic interval or repetition detection from raw records. Actual step
  boundaries come from FIT lap markers in this cycle.
- No Plan-owned zone-history subsystem and no mutable-config zone lookup for
  historical Target Ranges.
- No mandatory migration of existing Plans and no `schemaVersion: 2` solely for
  optional Prescribed Runs.
- No prescribed RPE targets and no per-step RPE capture.
- No coaching-style conclusions such as fitness diagnosis, readiness judgment,
  or training advice. The engine emits evidence and deltas.
- No new persistence database or cache. History comparison reads saved detailed
  YAML/JSON artifacts.
- No arbitrary partial-output history. A prior artifact must contain the data
  required for the requested comparison.
- No dedicated workout-builder UI or full plan-authoring workflow.
- No weather-, elevation-, cadence-, Running Dynamics-, or Stryd-specific
  comparison conclusions in v1.

## User stories

- As a runner quantifying a FIT File from a planned interval day, I see whether
  the captured lap sequence matched the Prescribed Run, so I can review the Run
  against what I intended to execute.
- As a runner comparing week 1 and week 4 versions of the same interval session,
  I see factual deltas for power, heart rate, pace, and RPE, so I can judge
  whether the later Run was controlled better at similar work.
- As a runner authoring a Plan, I write compact Prescription Notation such as
  `1.6K @ E[205-234W] -> 4(3min @ SUB-T[260-280W]/1min @ E) -> 1.6K @ E`, so I
  do not maintain a hand-expanded step list.
- As a runner whose zones change after a Testing Period, I keep old Prescribed
  Step Target Ranges in the notation, so historical comparisons do not depend on
  the current config file.
- As a runner who moves Tuesday's planned Run to Wednesday, I can override the
  Prescribed Run association, so comparison follows intent rather than calendar
  accident.
- As a maintainer adding the feature, I can test parsing, association,
  comparison, and formatting through structured data, so output wording changes
  do not break the behavior contract.

## Encounter statements

- A runner opening a Week in `plan.yaml` first encounters its Week Type and its
  compact `prescribed_runs` list together.
- A runner running `run2max quantify path/to/run.fit --plan . --format yaml`
  first encounters normal AnalysisResult sections plus a structured
  prescription-comparison section when a matching Prescribed Run exists.
- A runner reviewing a repeated interval session first sees current-vs-prior
  deltas only for Runs sharing an explicit Comparison Group.
- A maintainer opening the comparison code first sees FIT laps treated as the
  actual boundary source, not a hidden interval-detection heuristic.

## Constraints and assumptions

- Existing Plans without Prescribed Runs remain valid under `schemaVersion: 1`.
- Prescribed Runs are Block-specific instances, not reusable prescription
  templates in this cycle.
- Prescribed Runs live under their owning Week in `plan.yaml`.
- Prescription Notation with inline Target Ranges is the authoritative source
  for numeric intensity comparison in v1.
- FIT lap markers are required for Prescribed Step comparison. If the FIT File
  has no usable lap structure, Run2Max reports comparison unavailable rather
  than guessing.
- Run association defaults to local date and supports an explicit override for
  moved or ambiguous Runs.
- Comparable-history artifacts are saved detailed YAML/JSON outputs produced by
  Run2Max, paired to FIT Files by same basename in the Block folder.
- YAML and JSON history artifacts may differ in key casing but must not differ
  semantically when produced from the same detailed profile.
- RPE is actual run-level metadata from existing `--rpe` input, not a prescribed
  or per-step field.
- The engine remains framework-agnostic and free of CLI rendering concerns.

## Success metrics

- Existing Plan fixtures parse and validate without modification.
- Plans with valid `prescribed_runs` parse, validate, and expose Prescribed Run
  data through named engine types.
- Invalid Prescription Notation fails with actionable diagnostics, including
  missing Target Ranges on numerically comparable intensity steps.
- A fixture Run with FIT laps and a matching Prescribed Run produces a
  structured comparison whose step count and order match the expanded Prescribed
  Steps.
- A fixture Run without usable laps reports comparison unavailable without
  throwing and without fabricating steps.
- A moved-Run fixture can be compared to the intended Prescribed Run through an
  explicit override.
- Two saved detailed history artifacts in the same Comparison Group produce
  deterministic deltas for avg power, avg/max HR, avg pace, and run-level RPE
  where the source data is present.
- Partial or non-detailed history artifacts are rejected or skipped with a clear
  unavailable reason.
- `pnpm test` and package build/DTS checks pass at parent-issue closure.

## Success signals

- Reviewing a serious interval Run no longer requires mentally lining up Plan
  notes, FIT laps, and old YAML outputs by hand.
- The feature explains exactly why comparison is unavailable when data is
  missing, instead of silently falling back to weak heuristics.
- Adding another evidence metric later is localized to comparison data and
  formatter surfaces, not spread across Plan parsing, association, and history
  lookup.
- The Plan remains readable despite added Prescribed Runs because the authored
  notation stays compact.
- A future week-level adherence view can reuse Prescribed Run association and
  comparison data without redefining the prescription model.

## Open questions

- MUST RESOLVE: What exact CLI flag name and value shape should override the
  Prescribed Run association during `quantify`?
- MUST RESOLVE: What detailed-profile marker or validation rule proves a saved
  YAML/JSON artifact is detailed enough for history comparison?
- RESOLVE THROUGH IMPLEMENTATION: Exact structured output shape for the
  prescription-comparison section.
- RESOLVE THROUGH IMPLEMENTATION: Exact unavailable-reason taxonomy for missing
  laps, step-count mismatch, missing history artifact, partial history artifact,
  and missing RPE.
- RESOLVE THROUGH IMPLEMENTATION: Whether history lookup prefers YAML over JSON
  or rejects same-basename ambiguity when both exist.

Resolved during parent #53: Prescription Notation accepts both ASCII `->` and
Unicode `→`; parsed output is the canonical ordered Prescribed Step sequence,
while stored Plans preserve the runner's authored notation.
