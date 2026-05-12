# Sub-Issue #57 -- Implement engine Prescribed Run association

Vertical slice for parent #59. Delivers the pure engine association contract,
structured override options, and minimal `quantify` integration needed for
downstream lap comparison. This sub-issue intentionally does not add the CLI
override flag because the cycle PRD's access-surface question is still awaiting
explicit approval.

## Description

Add an engine function that associates a captured Run with at most one
Prescribed Run from a parsed Plan. Default association uses the Run's local date
to find the containing Week, then matches a Prescribed Run on that same
`localDate`. Structured override options can point at a Prescribed Run by local
date, label, or both across the entire Plan so moved Runs can follow intent even
when they cross Week boundaries.

Integrate the association into `quantify` only through structured engine
options. When a match exists, `AnalysisResult` carries a minimal
`prescribedRunContext` for downstream comparison. When no match exists, the pure
association function returns a labeled reason; this sub-issue does not define a
rendered unavailable message or final prescription-comparison output shape.

Out of scope: CLI flag parsing, rendered formatter output, FIT lap comparison,
history artifact lookup, prescription reparsing, Plan schema changes, and any
database/cache/config changes.

## Dependency classification

| Dependency                                                  | Category   | Testing strategy                                                                                           |
| ----------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `Plan`, `Week`, `PrescribedRun`, and `PrescribedStep` types | In-process | Construct parsed Plan fixtures directly and assert returned matches.                                       |
| `walkPlan` and `WeekContext`                                | In-process | Exercise through `findPrescribedRun`; assert returned Week metadata comes from the walked Week.            |
| Existing `associateRun` local-date Week matching behavior   | In-process | Reuse or extract the same date conversion and Week range rules; characterize with timezone boundary tests. |
| `Intl.DateTimeFormat` timezone conversion                   | In-process | Test with stable UTC and non-UTC cases already used by `associateRun` tests.                               |
| `QuantifyOptions` and `AnalysisResult` types                | In-process | Test through `quantify` integration and build/DTS output.                                                  |
| `quantify` pipeline                                         | In-process | Call `quantify` with parsed Plan data and structured override options.                                     |
| `valibot` Plan parser                                       | In-process | No schema change; use existing parser coverage plus targeted fixtures with `prescribedRuns`.               |

No local-substitutable, remote-owned, collaborator-owned, true external, or
irreplaceable dependency is introduced. No port is needed because association is
a pure in-process Plan lookup with no second adapter.

## Interface design

The interface this sub-issue commits to is the public engine association entry
point and the minimal structured context exposed on `AnalysisResult` when
`quantify` has both Plan data and a matched Prescribed Run.

### Design-it-twice

**Alternative A -- Quantify-only hidden association**

`quantify` internally finds a Prescribed Run and attaches a context field, but
no standalone function is exported.

```ts
export interface QuantifyOptions {
  plan?: Plan;
  prescribedRunOverride?: {
    localDate?: string;
    label?: string;
  };
}

export interface AnalysisResult {
  prescribedRunContext?: PrescribedRunContext;
}
```

- Leverage: low -- downstream tests and future comparison code cannot exercise
  association without constructing FIT input for `quantify`.
- Locality: medium -- code stays near `quantify`, but Plan lookup rules become
  hidden inside the analysis pipeline.
- Testability: low -- failure reasons are hard to verify without reaching into
  pipeline internals or asserting absence of output.

**Alternative B -- Pure association function plus structured quantify option**

`findPrescribedRun` is exported from the Plan area. `quantify` calls it when a
Plan is present and maps a successful match to a minimal context field.

```ts
// packages/engine/src/plan/associate.ts
export interface FindPrescribedRunOptions {
  overrideDate?: string;
  overrideLabel?: string;
}

export type FindPrescribedRunReason =
  | "no_week"
  | "no_prescribed_run"
  | "ambiguous";

export interface PrescribedRunMatch {
  prescribedRun: PrescribedRun;
  weekContext: WeekContext;
  matchKind: "date" | "override";
}

export type FindPrescribedRunResult =
  | { ok: true; match: PrescribedRunMatch }
  | { ok: false; reason: FindPrescribedRunReason };

export function findPrescribedRun(
  plan: Plan,
  runDate: Date,
  timezone: string,
  options?: FindPrescribedRunOptions,
): FindPrescribedRunResult;

// packages/engine/src/types.ts
export interface QuantifyOptions {
  plan?: Plan;
  prescribedRunOverride?: FindPrescribedRunOptions;
}

export interface PrescribedRunContext {
  label: string;
  localDate: string;
  comparisonGroup?: string;
  steps: PrescribedStep[];
  matchKind: "date" | "override";
  weekNumber: number;
  totalWeeks: number;
  weekType: string;
  mesocycle: string;
  fractalIndex: number;
  totalFractals: number;
  weekStart: string;
}

export interface AnalysisResult {
  prescribedRunContext?: PrescribedRunContext;
}
```

Example caller shape:

```ts
const result = findPrescribedRun(plan, summary.date, timezone, {
  overrideLabel: "Tuesday Intervals",
});

if (result.ok) {
  compareLater(result.match.prescribedRun.steps);
}
```

- Leverage: high -- comparison, tests, and later CLI wiring can reuse one
  association contract.
- Locality: high -- Plan lookup rules stay in the Plan module, while `quantify`
  performs only pipeline mapping.
- Testability: high -- every match and unavailable outcome is asserted without
  FIT parsing; `quantify` integration needs only smoke coverage.

**Alternative C -- Association plus CLI parsing and unavailable output**

This slice adds `findPrescribedRun`, `quantify` integration, a concrete
`--prescribed-run <value>` CLI flag, formatter output for unavailable reasons,
and the final prescription-comparison placeholder.

```ts
// packages/cli/src/commands/quantify.ts
// --prescribed-run <value> where YYYY-MM-DD is a date and other values are labels

export interface PrescriptionComparisonUnavailable {
  reason: "no_prescribed_run" | "ambiguous" | "no_laps";
  message: string;
}
```

- Leverage: medium -- users get an end-to-end access surface immediately, but
  the slice mixes association with downstream output decisions.
- Locality: low -- Plan lookup, CLI parsing, formatter prose, and future
  comparison taxonomy change together.
- Testability: medium -- more can be smoke-tested, but failures cross too many
  seams.

### Choice

**B (pure association function plus structured quantify option).** It is the
smallest public surface that gives downstream comparison a stable association
contract without prematurely resolving CLI flag syntax or final output shape.

A is rejected in one sentence: hiding association inside `quantify` makes the
core lookup hard to test and reuse. C is rejected in one sentence: it resolves
unapproved access-surface and formatter decisions in a slice whose purpose is
only association.

### Public interface

Entry point:

```ts
export function findPrescribedRun(
  plan: Plan,
  runDate: Date,
  timezone: string,
  options?: FindPrescribedRunOptions,
): FindPrescribedRunResult;
```

Inputs:

- `plan`: parsed Plan with optional Week-level `prescribedRuns`.
- `runDate`: captured Run date from `summary.date`.
- `timezone`: IANA timezone used to convert `runDate` to a local date for
  default matching.
- `overrideDate`: optional authored Prescribed Run `localDate` to search for
  across the Plan.
- `overrideLabel`: optional authored Prescribed Run `label` to search for across
  the Plan.

Outputs:

- `ok: true` with `PrescribedRunMatch` when exactly one Prescribed Run matches.
- `ok: false` with `no_week`, `no_prescribed_run`, or `ambiguous` when no single
  match can be selected.

Invariants:

- Default matching uses the Run's local date to find the containing Week, then
  searches only that Week for a Prescribed Run with the same `localDate`.
- Override matching searches all Weeks in Plan order and is not constrained to
  the Run date's Week.
- Supplying both override fields requires both fields to match the same
  Prescribed Run.
- A successful override has `matchKind: "override"` even if it points to the
  same Prescribed Run that default matching would have found.
- Label matching is exact and case-sensitive; this sub-issue does not introduce
  fuzzy label matching or label normalization.
- Multiple matching candidates return `ambiguous` rather than picking the first.
- When no override is supplied and the Run date falls outside every Week, return
  `no_week`.
- When override is supplied, a Run date outside every Week does not block
  matching; the override still searches the Plan.
- The function does not mutate Plan data and does not reparse
  `PrescribedRun.prescription`.

Error modes:

- The function does not throw for normal no-match cases.
- Invalid timezone behavior remains aligned with existing `associateRun` usage;
  CLI validation remains outside this sub-issue.
- Malformed override dates are treated as strings that do not match authored
  `localDate` values; no date parsing is performed in the association function.

## Acceptance criteria

- `findPrescribedRun` is implemented under `packages/engine/src/plan/` and
  exported from `@run2max/engine` with its result and option types.
- Default date matching returns a match only when exactly one Prescribed Run in
  the date-matched Week has `localDate` equal to the Run's local date.
- Default matching returns `no_week` when the Run date falls outside every Week.
- Default matching returns `no_prescribed_run` when the Run date maps to a Week
  that has no matching Prescribed Run.
- Default matching returns `ambiguous` when the date-matched Week has multiple
  matching Prescribed Runs.
- Override by date searches across the Plan and returns the uniquely matching
  Prescribed Run, including when that Prescribed Run belongs to a different Week
  from the captured Run's date.
- Override by label searches across the Plan and returns the uniquely matching
  Prescribed Run.
- Override with both date and label returns a match only when one Prescribed Run
  satisfies both fields.
- Override matching returns `no_prescribed_run` for zero matches and `ambiguous`
  for multiple matches.
- `quantify` accepts a structured `prescribedRunOverride` option and calls
  `findPrescribedRun` when parsed Plan data is present.
- `AnalysisResult.prescribedRunContext` is present only when association matches
  and includes label, localDate, optional comparisonGroup, steps, matchKind, and
  owning Week context.
- Existing `AnalysisResult.planContext` remains date-based and unchanged by a
  cross-Week Prescribed Run override.
- No CLI flag, rendered formatter section, lap comparison, or history lookup is
  introduced in this sub-issue.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and `pnpm build`.

## Proposed tests

1. **Default date match** -- a Run date inside a Week with exactly one
   Prescribed Run on that local date returns `ok: true` and `matchKind: "date"`.
2. **Default no Prescribed Run** -- a Run date inside a Week with no matching
   `prescribedRuns` returns `no_prescribed_run`.
3. **Default no Week** -- a Run date outside the Plan returns `no_week`.
4. **Default ambiguous** -- two Prescribed Runs on the same local date in the
   date-matched Week return `ambiguous`.
5. **Timezone boundary** -- the same UTC timestamp can match different local
   dates under different timezones, mirroring existing `associateRun` behavior.
6. **Override by date across Week boundary** -- a Wednesday captured Run can
   select a Tuesday Prescribed Run from the previous Week by `overrideDate`.
7. **Override by label across Week boundary** -- a moved Run can select a
   Prescribed Run from another Week by exact label.
8. **Override with both fields** -- date and label must identify the same
   Prescribed Run.
9. **Override no match** -- no candidate satisfying the override returns
   `no_prescribed_run`.
10. **Override ambiguous** -- duplicate labels or duplicate override dates
    across the Plan return `ambiguous`.
11. **Override with Run date outside Plan** -- override can still match a
    Prescribed Run when the captured Run's date is outside all Weeks.
12. **No lazy reparse** -- association uses existing `PrescribedRun.steps` and
    does not call `parsePrescriptionNotation`.
13. **Quantify default integration** -- `quantify` with a Plan and matching
    Prescribed Run includes `prescribedRunContext`.
14. **Quantify no match integration** -- `quantify` with a Plan but no matched
    Prescribed Run leaves `prescribedRunContext` undefined.
15. **Quantify override integration** -- `quantify` with `prescribedRunOverride`
    selects a cross-Week Prescribed Run while preserving date-based
    `planContext`.
16. **Public export smoke test** -- consumers can import `findPrescribedRun` and
    related types from `@run2max/engine`.

## Affected artifacts

- `packages/engine/src/plan/associate.ts` -- add `findPrescribedRun`, result
  types, structured override options, and any shared local-date helper extracted
  from existing Week association logic.
- `packages/engine/src/plan/associate.test.ts` -- add association unit tests for
  default matching, override matching, ambiguity, no-match reasons, and timezone
  behavior.
- `packages/engine/src/types.ts` -- add structured `prescribedRunOverride` to
  `QuantifyOptions`, add `PrescribedRunContext`, and add optional
  `prescribedRunContext` to `AnalysisResult`.
- `packages/engine/src/computations/quantify.ts` -- call `findPrescribedRun`
  when Plan data is present and map successful matches to
  `prescribedRunContext`.
- `packages/engine/src/computations/quantify.test.ts` -- add integration tests
  for matched, unmatched, and override association behavior.
- `packages/engine/src/index.ts` -- export the association function and public
  result/option/context types.
- `context/cycles/02-run-prescriptions-and-comparisons/issues/59-run-prescription-association/issue.md`
  -- update only if implementation reveals a parent-level flag or scope change.

## Dependencies

- Parent #59 must stay the active parent scope.
- Closed parent #53 provides parsed Prescribed Run data and expanded
  `PrescribedRun.steps`; do not reparse Prescription Notation here.
- Cycle 01 parent #35 provides `walkPlan`; do not add another Plan traversal
  abstraction.
- Existing `associateRun` behavior remains the source of truth for date-based
  Run-to-Week Plan Context. This sub-issue may extract shared local-date helpers
  only if it reduces duplication without changing behavior.
- The CLI override flag remains unresolved. Do not add or document a concrete
  CLI flag in code until the parent issue's access-surface flag is explicitly
  approved and the cycle PRD is updated.
- Do not add FIT lap comparison, formatter output, unavailable prose, history
  artifact lookup, database/cache behavior, or config schema changes.
