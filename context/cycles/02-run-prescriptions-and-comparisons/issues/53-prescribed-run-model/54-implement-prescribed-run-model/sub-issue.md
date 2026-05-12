# Sub-Issue #54 -- Implement the Prescribed Run model and notation parser

Vertical slice for parent issue #53. Delivers the full parent scope as a single
Plan/prescription foundation: add optional Week-level `prescribed_runs`, expose
named Prescribed Run and Prescribed Step types, parse v1 Prescription Notation,
and expand notation into ordered steps for downstream association and comparison
parents.

## Description

Add the authored Prescribed Run shape to parsed Plans without changing
`schemaVersion: 1`. A Week may now contain `prescribed_runs`, each with a local
date, label, authored Prescription Notation, optional Comparison Group, and an
expanded ordered Prescribed Step sequence derived from that notation.

The parser covers the v1 grammar from parent #53: ordered steps separated by
`->` or `→`, repetition groups such as `4(...)`, `/` between repeated
work/recovery steps, distance targets such as `1.6K`, duration targets such as
`3min`, intensity labels after `@`, and inline Target Ranges such as
`[205-234W]`. The implementation stops at structured Plan/prescription data. It
does not associate a captured Run to a Prescribed Run, inspect FIT laps, render
prescription-comparison output, or read history artifacts.

The scope is a vertical slice. If implementation reveals the parser and Plan
schema change cannot land safely together, split the parser into a sibling
sub-issue and leave this sub-issue as the Plan type/schema slice. Today, only
this sub-issue is planned.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| TypeScript compiler | In-process | Test directly through existing package test/build commands. |
| `vitest` | In-process | New parser and Plan schema tests run in the existing engine suite. |
| `valibot` Plan parser | In-process | Extend existing schema tests; do not introduce a second runtime validation library. |
| `transformKeysSnakeToCamel` | In-process | Test through a snake_case `prescribed_runs` fixture parsed by `parsePlan`. |
| Named Plan interfaces from parent #32 | In-process | Extend `Week` with optional `prescribedRuns`; type drift is covered by existing type-level Plan tests plus new type assertions if needed. |
| Plan walker from parent #35 | In-process | No direct implementation dependency in this sub-issue; downstream association work will use it to find Week-level Prescribed Runs. |

No remote, collaborator-owned, true external, or irreplaceable dependencies. No
port is required because parsing and expansion are pure in-process data
transformations with no second adapter.

## Interface design

The interface this sub-issue commits to is the Plan shape for Week-level
Prescribed Runs, the structured Prescribed Step shape, and the parser entry
point used by tests and downstream parents.

### Design-it-twice

**Alternative A -- Parsed Plan owns authored metadata plus expanded steps**

`parsePlan` returns a `Plan` whose `Week.prescribedRuns` entries preserve the
authored notation and also contain `steps`. The standalone parser is exported so
parser tests and future tooling can parse notation without loading a whole Plan.

```ts
// packages/engine/src/plan/types.ts
export interface TargetRange {
  metric: "power";
  min: number;
  max: number;
  unit: "W";
}

export type PrescribedStepTarget =
  | { kind: "distance"; value: number; unit: "km" }
  | { kind: "duration"; value: number; unit: "seconds" };

export interface PrescribedStep {
  index: number;
  target: PrescribedStepTarget;
  intensityLabel?: string;
  targetRange?: TargetRange;
  source: string;
}

export interface PrescribedRun {
  localDate: string;
  label: string;
  prescription: string;
  comparisonGroup?: string;
  steps: PrescribedStep[];
}

export interface Week {
  planned: string;
  start: string;
  executed?: string;
  reason?: string;
  note?: string;
  testingPeriod?: TestingPeriod;
  prescribedRuns?: PrescribedRun[];
}

// packages/engine/src/plan/prescription.ts
export interface PrescriptionDiagnostic {
  code: "syntax" | "unsupported" | "missing_target_range";
  message: string;
  token?: string;
  offset?: number;
}

export type PrescriptionParseResult =
  | { ok: true; steps: PrescribedStep[] }
  | { ok: false; diagnostics: PrescriptionDiagnostic[] };

export interface PrescriptionParseOptions {
  requireTargetRanges?: boolean;
}

export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult;
```

Example caller shape:

```ts
const plan = parsePlan(rawPlan);
const firstRun = plan.mesocycles[0]?.fractals[0]?.weeks[0]?.prescribedRuns?.[0];

if (firstRun) {
  for (const step of firstRun.steps) {
    compareLater(step.index, step.target, step.targetRange);
  }
}
```

- Leverage: high -- every downstream parent consumes the same parsed structure
  and avoids reparsing notation.
- Locality: high -- Plan parsing owns the authored-to-structured boundary;
  comparison and formatting modules receive domain data, not parser internals.
- Testability: high -- parser tests exercise the standalone entry point, while
  Plan schema tests prove `parsePlan` attaches steps to Week-level Prescribed
  Runs.

**Alternative B -- Authored Plan shape only, parser called lazily by consumers**

`parsePlan` accepts and returns only authored Prescribed Run metadata. Downstream
parents call the parser when they need steps.

```ts
// packages/engine/src/plan/types.ts
export interface PrescribedRun {
  localDate: string;
  label: string;
  prescription: string;
  comparisonGroup?: string;
}

export interface Week {
  planned: string;
  start: string;
  prescribedRuns?: PrescribedRun[];
}

// packages/engine/src/plan/prescription.ts
export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult;

// Later comparison caller
const parsed = parsePrescriptionNotation(prescribedRun.prescription);
if (!parsed.ok) return unavailable(parsed.diagnostics);
return compareSegmentsToSteps(segments, parsed.steps);
```

- Leverage: medium -- the Plan schema change is smaller, but every consumer that
  needs steps must remember to parse first.
- Locality: medium -- parser logic is local, but parser invocation leaks into
  association, comparison, formatter, and history-adjacent code paths over time.
- Testability: medium -- parser tests remain simple, but downstream tests must
  repeatedly arrange parser success/failure before exercising their own logic.

**Alternative C -- Rich AST plus expanded steps for strongest parser encounter**

The parser returns both a syntax tree and flattened steps. The parsed Plan stores
the rich result so future diagnostics and tooling can point to nested group
structure.

```ts
export type PrescriptionNode =
  | { kind: "step"; source: string; target: PrescribedStepTarget; intensityLabel?: string; targetRange?: TargetRange }
  | { kind: "sequence"; nodes: PrescriptionNode[] }
  | { kind: "repeat"; count: number; pattern: PrescriptionNode[] };

export interface ParsedPrescription {
  ast: PrescriptionNode;
  steps: PrescribedStep[];
}

export interface PrescribedRun {
  localDate: string;
  label: string;
  prescription: string;
  comparisonGroup?: string;
  parsedPrescription: ParsedPrescription;
}

export function parsePrescriptionNotation(input: string):
  | { ok: true; value: ParsedPrescription }
  | { ok: false; diagnostics: PrescriptionDiagnostic[] };
```

Example caller shape:

```ts
const nodes = prescribedRun.parsedPrescription.ast;
const steps = prescribedRun.parsedPrescription.steps;
renderFutureAuthoringHint(nodes);
compareSegmentsToSteps(segments, steps);
```

- Leverage: low for this cycle -- downstream parents need ordered Prescribed
  Steps, not a grammar tree.
- Locality: medium -- parser internals become part of the public Plan shape,
  making later grammar changes harder.
- Testability: lower -- tests must assert tree structure in addition to the
  domain output that comparison actually consumes.

### Choice

**A (parsed Plan owns authored metadata plus expanded steps).** It is the
smallest public surface that prevents downstream parents from reparsing
Prescription Notation while keeping parser internals out of the Plan shape.

B is rejected in one sentence: it keeps the Plan shape smaller but makes every
step-consuming parent repeat parser invocation and error handling.

C is rejected in one sentence: exposing a grammar AST is stronger than the cycle
needs and would make v1 notation internals harder to revise.

### Module location

`packages/engine/src/plan/prescription.ts` holds the parser, diagnostics, and
notation-specific helpers. Prescription domain interfaces live in
`packages/engine/src/plan/types.ts` with `Week`, because Prescribed Runs are
parsed Plan data rather than a derived comparison result.

Rejected: putting the parser under `computations/`. One sentence:
Prescription Notation belongs to Plan authoring, while `computations/` operates
on captured Run data.

### Public interface

```ts
// packages/engine/src/plan/types.ts
export interface TargetRange {
  metric: "power";
  min: number;
  max: number;
  unit: "W";
}

export type PrescribedStepTarget =
  | { kind: "distance"; value: number; unit: "km" }
  | { kind: "duration"; value: number; unit: "seconds" };

export interface PrescribedStep {
  index: number;
  target: PrescribedStepTarget;
  intensityLabel?: string;
  targetRange?: TargetRange;
  source: string;
}

export interface PrescribedRun {
  localDate: string;
  label: string;
  prescription: string;
  comparisonGroup?: string;
  steps: PrescribedStep[];
}

// packages/engine/src/plan/prescription.ts
export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult;
```

Input YAML shape after snake-to-camel normalization:

```yaml
prescribed_runs:
  - local_date: "2026-05-12"
    label: Sub-threshold intervals
    prescription: "1.6K @ E[205-234W] -> 4(3min @ SUB-T[260-280W]/1min @ E) -> 1.6K @ E"
    comparison_group: sub-t-3min
```

Invariants:

- `prescribedRuns` is optional. Omitted means the Week has no Prescribed Runs;
  existing Plans stay valid.
- `PrescribedRun.prescription` preserves the authored notation string exactly as
  parsed from the Plan after YAML decoding.
- `PrescribedRun.steps` is ordered by `index`, starting at 1, and includes every
  expanded step from warmup through cooldown.
- Repetition expansion preserves authored order. `4(A/B)` yields `A, B, A, B,
  A, B, A, B` after any surrounding sequence steps.
- `TargetRange` v1 supports power ranges in watts only. Do not infer ranges from
  Zone labels.
- `parsePrescriptionNotation(input)` accepts both `->` and `→` as separators;
  parsed output does not preserve which arrow spelling was used.
- `requireTargetRanges` is an explicit parser option for tests and future
  strict-mode call sites. Default Plan parsing allows steps without Target
  Ranges so recovery/cooldown notation like `1min @ E` remains valid.

Error modes:

- `parsePrescriptionNotation` does not throw. It returns `ok: false` with one or
  more `PrescriptionDiagnostic` values for syntax errors, unsupported targets or
  units, and missing Target Ranges when `requireTargetRanges` is true.
- `parsePlan` fails when a `prescribed_runs` entry has malformed required
  metadata or notation that cannot be parsed under the default parser policy.
  The thrown error message must include the Prescribed Run label or local date
  when available.

## Acceptance criteria

- `packages/engine/src/plan/types.ts` defines and exports `PrescribedRun`,
  `PrescribedStep`, `PrescribedStepTarget`, and `TargetRange`; `Week` gains
  optional `prescribedRuns?: PrescribedRun[]`.
- `packages/engine/src/plan/schema.ts` accepts `prescribed_runs` in Plan YAML,
  transforms it to `prescribedRuns`, and keeps existing Plans without the field
  valid under `schemaVersion: 1`.
- Parsed Prescribed Runs carry `localDate`, `label`, `prescription`, optional
  `comparisonGroup`, and expanded `steps`.
- `parsePrescriptionNotation` parses simple distance steps, simple duration
  steps, ordered `->` sequences, ordered `→` sequences, repetition groups,
  repeated work/recovery pairs separated by `/`, intensity labels after `@`,
  and inline power Target Ranges.
- Repetition expansion produces stable 1-based step indexes and preserves order.
- Invalid notation returns actionable diagnostics from the standalone parser and
  fails Plan parsing when the invalid notation is inside `prescribed_runs`.
- Missing Target Range diagnostics are covered through
  `requireTargetRanges: true`; default Plan parsing does not reject range-less
  recovery/cooldown steps.
- `@run2max/engine` exports the new domain types and `parsePrescriptionNotation`
  under the Periodization grouping.
- No Run association, FIT lap comparison, output formatting, history lookup,
  database/cache, or zone-history lookup is introduced.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and any package build/DTS checks already defined in the repository.

## Proposed tests

1. **Parser unit tests** -- add `packages/engine/src/plan/prescription.test.ts`.
   Cover:
   - `1.6K @ E[205-234W]` parses as one distance step with a power Target Range.
   - `3min @ SUB-T[260-280W]` parses as one duration step.
   - `1.6K @ E[205-234W] -> 3min @ SUB-T[260-280W]` preserves sequence order.
   - The same sequence using `→` produces equivalent steps.
   - `4(3min @ SUB-T[260-280W]/1min @ E)` expands to eight ordered steps.
   - Malformed tokens and unsupported units return `ok: false` diagnostics.
   - `parsePrescriptionNotation("1min @ E", { requireTargetRanges: true })`
     returns a `missing_target_range` diagnostic.
2. **Plan schema tests** -- extend `packages/engine/src/plan/schema.test.ts` or
   add focused coverage that parses a Plan fixture containing `prescribed_runs`
   and asserts `prescribedRuns[0].steps` is populated.
3. **Existing Plan compatibility tests** -- existing fixtures without
   `prescribed_runs` continue to parse and validate unchanged.
4. **Type-level drift guard** -- extend `packages/engine/src/plan/types.test-d.ts`
   if needed so the named `Week` interface and `WeekSchema` output remain
   assignable after `prescribedRuns` is added.
5. **Public export smoke test** -- existing package export/type tests, or a new
   minimal import test if no export test exists, verify consumers can import the
   new types and `parsePrescriptionNotation` from `@run2max/engine`.

## Affected artifacts

- `packages/engine/src/plan/types.ts` -- add Prescribed Run/Step/Target Range
  interfaces and extend `Week`.
- `packages/engine/src/plan/schema.ts` -- accept `prescribed_runs`, parse
  notation, and attach expanded steps.
- `packages/engine/src/plan/prescription.ts` -- **new file**, parser and parser
  diagnostics.
- `packages/engine/src/plan/prescription.test.ts` -- **new file**, parser tests.
- `packages/engine/src/plan/schema.test.ts` -- add Plan fixture coverage for
  `prescribed_runs`.
- `packages/engine/src/plan/types.test-d.ts` -- update only if assignability
  guards need explicit Prescribed Run coverage.
- `packages/engine/src/index.ts` -- export the new types and parser entry point.
- Existing Plan fixtures -- add a targeted fixture only if current tests need a
  reusable prescribed-run Plan; do not mutate broad fixtures unless necessary.

## Dependencies

- Parent #53 must stay the active parent scope. Do not start Run association or
  comparison work until this sub-issue closes.
- Cycle 01 parent #32 is closed. Keep named Plan interfaces public and do not
  reintroduce `v.InferOutput` as public prescription types.
- Cycle 01 parent #35 is closed. Do not add another Plan traversal abstraction;
  later association work should use `walkPlan`.
- Parent #53 flags apply: accept both arrow spellings, do not infer Target
  Ranges from Zone labels, do not add reusable prescription templates, and do
  not add automatic interval detection.
- If parser grammar decisions expand beyond the v1 constructs listed here,
  pause and consider an ADR before implementing the wider grammar.
