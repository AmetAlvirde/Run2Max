# Parent Issue #56 -- Run-to-Prescribed-Run Association

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance Criteria

- The engine exposes a pure association entry point under the Plan area that
  accepts parsed Plan data, a Run date, a timezone, and optional structured
  override options. It returns either one matched Prescribed Run with its owning
  Week context or a labeled unavailable result.
- Default association converts the Run date to a local date using the supplied
  timezone, finds the Week that contains that local date using the existing
  Run-to-Week date logic, and searches only that Week's `prescribedRuns` for the
  same `localDate`.
- Default association succeeds only when exactly one Prescribed Run in the
  date-matched Week has the matching `localDate`. Zero matches returns
  `no_prescribed_run`; multiple matches returns `ambiguous`.
- When the Run date falls outside every Week and no override is provided, the
  association returns `no_week` without attempting a Prescribed Run lookup.
- Explicit override options search the parsed Plan for the intended Prescribed
  Run and are not constrained to the Week that contains the captured Run's date.
  This supports moved Runs across Week boundaries.
- Override by date matches Prescribed Runs whose `localDate` equals the override
  date. Override by label matches Prescribed Runs whose `label` equals the
  override label. Supplying both date and label requires both fields to match
  the same Prescribed Run.
- Override association succeeds only when exactly one Prescribed Run satisfies
  the override. Zero matches returns `no_prescribed_run`; multiple matches
  returns `ambiguous`.
- The association result includes enough Week context for downstream comparison
  and diagnostics: Week number, total Weeks, Week Type, Mesocycle name, Fractal
  index, total Fractals, Week start, and the matched Prescribed Run.
- The association result uses the already-expanded `PrescribedRun.steps` from
  parent #53. It does not reparse `PrescribedRun.prescription`.
- `quantify` integrates the association only when parsed Plan data is available.
  The resulting `AnalysisResult` may expose a minimal `prescribedRunContext`
  field, but this parent must not define the final prescription-comparison
  output shape owned by downstream comparison and formatter parents.
- The existing date-based `planContext` behavior remains intact. If an override
  points at a Prescribed Run in a different Week from the captured Run's date,
  the Prescribed Run association reports the intended Prescribed Run's owning
  Week separately rather than silently redefining Plan Context.
- The quantify access-surface override is not yet resolved. The first sub-issue
  must confirm the exact CLI flag name and value shape before implementation,
  then update this issue and the cycle PRD when approved.
- Structured tests cover: default date match; no Prescribed Run on the Run date;
  duplicate Prescribed Runs on the date returning `ambiguous`; override by date;
  override by label; override with both date and label; override across a Week
  boundary; override with no match; override with multiple matches; Run date
  outside all Weeks without override; Plan with no `prescribedRuns`.
- Existing Plan fixtures and tests pass without modification. Plans without
  `prescribedRuns` remain valid and produce no Prescribed Run association.
- Repository-runnable verification commands succeed at parent closure, including
  `pnpm test` and package build/DTS checks already defined in the repository.

## Implementation Approach

1. Confirm the association interface in the first sub-issue before writing code.
   The interface should stay in-process and operate on parsed Plan data, a Run
   date, a timezone, and structured override options.
2. Reuse `walkPlan` to traverse Weeks and reuse or extract the existing
   Run-to-Week local-date comparison from `associateRun`. Do not introduce a
   second Plan traversal abstraction.
3. Implement default association and override association as one pure lookup.
   Default matching is local-date-to-current-Week; override matching searches
   the Plan for the intended Prescribed Run.
4. Add engine tests for association outcomes before integrating with `quantify`.
5. Add the minimal `QuantifyOptions` field needed to pass a structured override
   into the engine after the access-surface decision is approved.
6. Integrate the association into `quantify` without changing the semantics of
   existing `planContext`.
7. Export only the association entry point and public result types needed by
   downstream comparison work. Avoid formatter helpers and prescription-
   comparison output types in this parent.

This parent is expected to close in one vertical slice if the first sub-issue
can cover the pure association, quantify integration, and approved
access-surface wiring together. If access-surface approval blocks
implementation, split the pure engine association into the first sub-issue and
defer CLI wiring to a sibling sub-issue.

## Dependencies

- Upstream: closed parent #53 provides Prescribed Run and Prescribed Step Plan
  data, including expanded `PrescribedRun.steps`.
- Upstream: cycle 01 parent #35 provides `walkPlan` and Week Context traversal.
- Upstream: existing `associateRun` provides date-based Run-to-Week behavior for
  Plan Context enrichment.
- Downstream: lap-aligned step comparison consumes the matched Prescribed Run
  and its owning Week context.
- Downstream: prescription-comparison formatting consumes comparison results,
  not the raw association result alone.
- Downstream: comparable-history deltas consume the matched Prescribed Run's
  Comparison Group.
- External: no new persistence layer, database, config schema changes, zone
  subsystem changes, external service calls, or history artifact reads.
- Tooling: use repository-defined commands only. Existing `pnpm test` and
  `pnpm build` scripts are sufficient for parent closure.

## Flags

- The cycle PRD's MUST RESOLVE question remains open until approved: "What exact
  CLI flag name and value shape should override the Prescribed Run association
  during `quantify`?" Candidate design: a single `--prescribed-run <value>` flag
  where `YYYY-MM-DD` is interpreted as an override date and other strings as an
  override label. This is not accepted until explicitly greenlit.
- If a single-string CLI flag is approved, document the date-shaped-label
  ambiguity. A Prescribed Run label such as `2026-05-12` would be interpreted as
  a date unless a separate label-specific flag is introduced.
- No lazy reparse: association uses `PrescribedRun.steps`; it does not inspect
  parser internals or reparse `PrescribedRun.prescription`.
- Do not add lap comparison logic here. The match result provides the Prescribed
  Run and owning Week context; comparison happens downstream.
- Do not add rendered formatter output here. Downstream formatter work should
  render prescription-comparison results, not this parent-level association
  alone.
- Do not add history lookup or artifact comparison here. The Comparison Group is
  carried forward for downstream history work.
- [ ] [57-engine-association-and-override -> sibling sub-issue TBD]

  Sub-issue #57 closed the pure engine association and quantify-side structured
  override input, but intentionally did not implement CLI access-surface wiring.
  Create a sibling sub-issue to resolve and implement the quantify override flag
  name/value shape, then map it to `QuantifyOptions.prescribedRunOverride`.

  Files to review:
  - context/cycles/02-run-prescriptions-and-comparisons/issues/56-run-prescription-association/57-engine-association-and-override/sub-issue.md
  - context/cycles/02-run-prescriptions-and-comparisons/issues/56-run-prescription-association/57-engine-association-and-override/aar.md

  (See source AAR for full context)
