# Sub-Issue #74 -- Harden Prescription Notation validation

Vertical slice for parent #73. Delivers the parser and Plan-loading validation
fixes that make invalid Prescription Notation fail before it reaches
association, comparison, formatting, or comparable history.

## Description

Harden the v1 Prescription Notation contract from parent #53. Plan loading must
exercise the same validation that parser tests exercise, Target Range
requirements must be applied per numerically comparable Prescribed Step, and the
parser must reject impossible numeric values instead of preserving nonsense
targets for downstream comparison.

This sub-issue covers the audit findings for the dead `requireTargetRanges`
seam, missing numerically comparable classification, Target Range numeric
invariants, zero distance/duration values, and the repetition-count policy. It
does not change diagnostic propagation through `loadPlan`; that is sub-issue
#75.

## Dependency classification

| Dependency                               | Category                                       | Testing strategy                                                                                                      |
| ---------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `parsePrescriptionNotation` parser       | In-process                                     | Test directly through parser unit tests for valid mixed comparable/non-comparable steps and invalid numeric values.   |
| `parsePlan` Plan schema transform        | In-process                                     | Test through Plan parsing so production Plan loading enforces the same parser options as standalone parser calls.     |
| Prescribed Run and Prescribed Step types | In-process                                     | Assert parsed `Week.prescribedRuns[].steps` preserve valid data and omit invalid data by throwing at Plan parse time. |
| `vitest`                                 | In-process                                     | Add focused engine tests near existing parser/schema tests.                                                           |
| Current Zone config                      | In-process, explicitly not a validation source | Tests prove validation does not look up mutable Zone values to fill missing Target Ranges.                            |

No local-substitutable, remote-owned, collaborator-owned, true external, or
irreplaceable dependency is introduced. No port is required because validation
is a pure in-process transformation with one production implementation.

## Interface design

The interface this sub-issue commits to is the parser/Plan-loading validation
surface used by parent #53 and all downstream parents.

### Design-it-twice

**Alternative A -- Parser-owned validation policy with Plan-load enforcement**

Keep `parsePrescriptionNotation` as the single validation entry point. Add a
parser-owned policy for numerically comparable intensity labels and numeric
invariants, then call the parser from `parsePlan` with the production validation
mode enabled.

```ts
export interface PrescriptionParseOptions {
  requireTargetRanges?: boolean | "comparable";
  maxRepeatCount?: number;
}

export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult;
```

Production Plan parsing uses the comparable-only mode. Tests may still exercise
parser behavior directly with explicit options.

- Leverage: high -- every caller that enters through Plan loading receives the
  hardened contract without duplicating parser rules.
- Locality: high -- grammar parsing, comparable-label classification, and
  numeric validation live together.
- Testability: high -- parser tests cover each rule and one Plan integration
  test proves production enforcement.

**Alternative B -- Caller-supplied comparable-label set**

The parser accepts a set or predicate from callers that decides which intensity
labels require Target Ranges.

```ts
export interface PrescriptionParseOptions {
  targetRangeRequiredFor?: (intensityLabel: string) => boolean;
}
```

- Leverage: medium -- callers can customize policy, but cycle 02 has only one
  production policy.
- Locality: lower -- Plan loading would own part of the parser's validity rules.
- Testability: medium -- tests must arrange policy injection before exercising
  grammar behavior.

**Alternative C -- Validate after parsing in the Plan schema**

Leave the parser permissive and add a separate validation pass after
`parsePrescriptionNotation` succeeds inside `parsePlan`.

```ts
const parsed = parsePrescriptionNotation(run.prescription);
const diagnostics = validateParsedPrescription(parsed.steps);
```

- Leverage: low -- standalone parser callers can still miss production
  validation.
- Locality: low -- grammar validity and semantic validity drift apart.
- Testability: medium -- parser tests and Plan tests must duplicate invalid
  cases to prove parity.

### Choice

**A (parser-owned validation policy with Plan-load enforcement).** It is the
smallest surface that makes the Plan boundary reliable while keeping validation
rules next to the grammar they interpret.

B is rejected in one sentence: cycle 02 has one validation policy, so injecting
a predicate creates configuration surface without a second real adapter. C is
rejected in one sentence: post-parse validation would let standalone parser
callers observe a weaker contract than production Plan loading.

### Public interface

Entry points:

```ts
export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult;

export function parsePlan(input: unknown): Plan;
```

Inputs:

- `input`: authored Prescription Notation string.
- `requireTargetRanges`: when set to comparable-only production mode, only
  numerically comparable intensity labels require an inline Target Range.
- `maxRepeatCount`: finite guard for repetition expansion. If the implementation
  chooses a fixed constant instead of an option, record that constant in code
  and the parent closure notes.

Outputs:

- Success returns ordered `PrescribedStep[]` with valid positive distance or
  duration targets and valid Target Ranges.
- Failure returns `PrescriptionDiagnostic[]` at the parser seam or throws at the
  Plan seam according to the existing `parsePlan` contract refined by sub-issue
  #75.

Invariants:

- Target Range `min` and `max` are finite numbers.
- Target Range lower bound is not greater than upper bound.
- A range that cannot match any positive captured power, such as `0-0W`, is
  rejected.
- Distance and duration targets are finite and greater than zero.
- Repetition counts are positive integers and cannot exceed the chosen v1 cap.
- Non-comparable easy/recovery-style steps may omit Target Ranges without
  failing the production Plan-loading path.
- Validation never reads current Zone configuration or Testing Period history.

Error modes:

- Missing required Target Range reports `missing_target_range`.
- Reversed or non-positive Target Ranges report a validation diagnostic distinct
  from generic syntax failure.
- Zero distance/duration reports a validation diagnostic distinct from generic
  syntax failure.
- Repetition count over the v1 cap reports an actionable validation diagnostic.

## Acceptance criteria

- `parsePlan` invokes Prescription Notation parsing with production validation
  enabled for `prescribed_runs`.
- Parser tests cover mixed comparable/non-comparable labels where comparable
  steps without Target Ranges fail and non-comparable steps may pass.
- Parser tests cover reversed Target Range, `0-0W` Target Range, zero distance,
  zero duration, and over-cap repetition count or a recorded deferral for the
  cap decision.
- Existing valid examples from parent #53 continue to parse to the same ordered
  Prescribed Step sequence.
- No current Zone config lookup is introduced to infer missing Target Ranges.

## Proposed tests

- Parser unit: `1min @ E -> 3min @ T` with production validation reports one
  missing Target Range for the comparable step only.
- Parser unit: `[234-205W]` fails with a range-order diagnostic.
- Parser unit: `[0-0W]` fails with a non-positive or unmatchable-range
  diagnostic.
- Parser unit: `0K @ E[205-234W]` and `0min @ T[260-280W]` fail.
- Parser unit: over-cap repetition count fails without expanding thousands of
  steps.
- Plan integration: a `prescribed_runs` entry with a comparable step missing a
  Target Range fails through `parsePlan`, not only through direct parser calls.
- Regression: valid recovery/easy step without Target Range remains valid when
  classified as non-comparable.

## Affected artifacts

- `packages/engine/src/plan/prescription.ts`
- `packages/engine/src/plan/prescription.test.ts`
- `packages/engine/src/plan/schema.ts`
- Plan schema/parser tests near existing `parsePlan` coverage
- Parent closure notes or ADR/AAR if the v1 repetition cap or comparable-label
  classification is treated as a public grammar decision

## Dependencies

- Upstream: parent #53 parser/types/schema implementation.
- Downstream: sub-issue #75 must preserve and propagate the diagnostics produced
  here.
- Downstream: sub-issues #76 and #77 are independent and should not begin until
  this parser contract is stable enough for parent verification.
