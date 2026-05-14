# Sub-Issue #76 -- Surface prescribed-run override failures in CLI

Vertical slice for parent #73. Delivers user-visible failure when a runner
explicitly supplies `--prescribed-run` and the engine cannot resolve that
override to exactly one Prescribed Run.

## Description

Make explicit Prescribed Run override failures loud at the CLI seam. Today
`findPrescribedRun` returns labeled failure reasons, but `quantify` discards
those reasons and the CLI prints output with no indication that the requested
override failed. This sub-issue preserves the existing non-fatal default
association behavior while making user-supplied override failure a command
error.

It also adds the missing engine invariant test that duplicate dates in another
Week do not make default date association ambiguous when the current Week has a
single matching Prescribed Run.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| `findPrescribedRun` | In-process | Test directly for default-mode duplicate-date behavior and override failure reasons. |
| `quantify` prescription association | In-process | Test through engine `quantify` with mocked FIT normalization as existing quantify tests do. |
| CLI `parsePrescribedRunOverride` | In-process | Existing helper tests remain; add command-level tests for failure propagation. |
| CLI process exit/stderr seam | Local-substitutable | Use existing CLI test harness/mocks to assert `fatal` behavior without running a real process. |
| FIT parsing in command tests | Local-substitutable | Keep using the existing mocked `@run2max/engine` or normalize-fit-file setup for CLI seam tests. |

No remote-owned, collaborator-owned, true external, or irreplaceable dependency
is introduced for the CLI behavior. No port is required because existing tests
already substitute the command boundary and FIT parsing is not the behavior under
test.

## Interface design

The interface this sub-issue commits to is how explicit override failure moves
from engine association to CLI error handling.

### Design-it-twice

**Alternative A -- Engine throws a typed override error for explicit failures**

When `quantify` receives `prescribedRunOverride` and `findPrescribedRun` returns
`ok: false`, throw a typed error that carries the labeled association reason and
the attempted override. The CLI catches that error separately from FIT parsing
errors and exits non-zero with a clear message.

```ts
export class PrescribedRunOverrideError extends Error {
  reason: FindPrescribedRunReason;
  override: FindPrescribedRunOptions;
}
```

- Leverage: high -- every engine caller that opts into explicit override gets a
  loud failure instead of an incomplete result.
- Locality: high -- the engine owns association semantics; the CLI owns message
  formatting and process exit.
- Testability: high -- engine tests assert typed error fields, CLI tests assert
  stderr/exit behavior.

**Alternative B -- CLI preflights the override before calling `quantify`**

The CLI loads the Plan, determines the Run date, calls `findPrescribedRun`, and
fails before invoking `quantify` if the override does not match.

- Leverage: medium -- CLI behavior is fixed, but non-CLI engine callers still
  get silent failure.
- Locality: low -- the CLI duplicates engine orchestration and needs access to
  the same date/timezone facts as `quantify`.
- Testability: medium -- CLI tests cover behavior, but engine behavior remains
  risky.

**Alternative C -- Add association failure to `AnalysisResult`**

Return successful analysis with a new optional field such as
`prescribedRunAssociationFailure`, and let the CLI decide whether to fail after
formatting.

- Leverage: medium -- consumers can inspect failure without exceptions.
- Locality: medium -- association result becomes part of the output model even
  though explicit override failure should stop CLI output.
- Testability: medium -- formatters need decisions about whether to emit the new
  field.

### Choice

**A (engine throws a typed override error for explicit failures).** It fixes the
silent failure for all explicit engine callers while keeping default association
failure non-fatal and avoiding a new output field.

B is rejected in one sentence: CLI preflight would duplicate association logic
and still leave engine callers with the old silent behavior. C is rejected in one
sentence: explicit override failure is invalid user input, not successful
analysis output.

### Public interface

Entry points:

```ts
export function findPrescribedRun(
  plan: Plan,
  runDate: Date,
  timezone: string,
  options?: FindPrescribedRunOptions,
): FindPrescribedRunResult;

export class PrescribedRunOverrideError extends Error {
  reason: FindPrescribedRunReason;
  override: FindPrescribedRunOptions;
}

export async function quantify(
  fitBuffer: ArrayBuffer,
  options: QuantifyOptions,
): Promise<AnalysisResult>;
```

Inputs:

- `prescribedRunOverride`: parsed CLI override as `overrideDate` or
  `overrideLabel`.
- `plan`: required by the CLI when an override is supplied, as already enforced.
- `timezone`: same timezone used for default association.

Outputs:

- Default association failure continues to produce no `prescribedRunContext` and
  no `prescriptionComparison`.
- Explicit override failure throws `PrescribedRunOverrideError` with
  `reason: "ambiguous" | "no_prescribed_run" | "no_week"`.
- CLI maps the typed error to a non-zero exit and stderr message that includes
  the reason and the attempted selector.

Invariants:

- An explicit override must match exactly one Prescribed Run.
- `ambiguous` remains a labeled engine outcome, not a generic CLI message.
- Duplicate dates outside the current Week do not affect default date matching.
- The CLI does not print normal analysis output after an explicit override
  failure.

Error modes:

- `ambiguous`: fail because the selector matched more than one Prescribed Run.
- `no_prescribed_run`: fail because the selector matched no Prescribed Run.
- `no_week`: fail when the Run's local date is not covered by any Week in the
  Plan, so the override cannot be resolved within a Week context.

## Acceptance criteria

- Engine `quantify` throws a typed/labeled error when `prescribedRunOverride` is
  provided and `findPrescribedRun` returns `ok: false`.
- CLI catches the typed override error before the generic FIT parse wrapper and
  exits non-zero with a useful stderr message.
- CLI regression tests cover at least one explicit override failure; engine tests
  cover the remaining labeled reasons or a direct `findPrescribedRun` matrix.
- Engine association test covers duplicate dates in another Week not producing
  default-mode ambiguity.
- Existing successful override and default-association tests continue to pass.

## Proposed tests

- Engine unit: default date matching finds the current Week's run even if another
  Week contains the same `localDate` string.
- Engine unit: explicit label override with two matching labels throws or returns
  `ambiguous` at the chosen seam.
- Engine unit: explicit date override with no matching Prescribed Run throws a
  typed `no_prescribed_run` error from `quantify`.
- CLI command: `--prescribed-run "Wednesday Intervals"` against an ambiguous
  fixture exits non-zero and writes an error containing `ambiguous`.
- CLI command: override failure does not write formatted analysis output.
- Regression: no `--prescribed-run` and no matching Prescribed Run remains
  non-fatal.

## Affected artifacts

- `packages/engine/src/plan/associate.ts`
- `packages/engine/src/plan/associate.test.ts`
- `packages/engine/src/computations/quantify.ts`
- `packages/engine/src/computations/quantify.test.ts`
- `packages/engine/src/index.ts` if the typed error is exported
- `packages/cli/src/commands/quantify.ts`
- `packages/cli/src/commands/quantify.test.ts`

## Dependencies

- Upstream: parent #59 association and CLI override grammar.
- Independent: sub-issues #74 and #75 should finish first so CLI failures are
  not confused with Plan-loading prescription errors.
- Downstream: parent closure uses these tests as evidence that the audit's
  silent explicit-override failure is resolved.
