# Sub-Issue #75 -- Preserve actionable prescription diagnostics

Vertical slice for parent #73. Delivers diagnostic quality and propagation for
Prescription Notation failures after sub-issue #74 hardens validation.

## Description

Keep Prescription Notation diagnostics actionable from parser internals through
Plan loading. Nested repetition should report an unsupported construct instead
of generic syntax failure, parser diagnostics should not stop at the first
independent malformed step, and Plan/loader boundaries should preserve
structured diagnostic context rather than throwing a plain first-message
`Error`.

This sub-issue also resolves the `offset` contract. Pre-decision: remove
`offset` from the public `PrescriptionDiagnostic` type. The field is currently
declared but never populated, `token` already conveys the offending span well
enough for actionable diagnostics, and removing it is the smaller and lower-risk
move for a reliability pass. If a later cycle needs character-level span
information for editor tooling, it can reintroduce a populated field with tests
guaranteeing population.

## Dependency classification

| Dependency                              | Category      | Testing strategy                                                                                                            |
| --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `parsePrescriptionNotation` diagnostics | In-process    | Test directly through parser unit tests for codes, tokens, offsets, and multiple diagnostics.                               |
| `parsePlan`                             | In-process    | Test through Plan parsing so prescription diagnostics survive the schema transform boundary.                                |
| `loadPlan` filesystem boundary          | Irreplaceable | Use a temporary or fixture Plan file to prove file path context is added at the loader boundary.                            |
| `valibot` errors                        | In-process    | Existing loader behavior for `ValiError` remains covered by current tests; add tests only where prescription errors differ. |
| `vitest`                                | In-process    | Add focused parser, schema, and loader tests.                                                                               |

No remote-owned, collaborator-owned, or true external dependency is introduced.
No port is required. The loader already owns the filesystem boundary and tests
can exercise it directly with local files.

## Interface design

The interface this sub-issue commits to is the structured diagnostic shape and
the error type used when Plan loading rejects invalid Prescription Notation.

### Design-it-twice

**Alternative A -- Typed prescription error carrying parser diagnostics**

Keep `parsePrescriptionNotation` as a result-returning function. When
`parsePlan` encounters a failed prescription parse, throw a typed error that
carries all diagnostics and Prescribed Run context. `loadPlan` recognizes the
typed error and adds file path context without discarding diagnostic fields.

```ts
export interface PrescriptionDiagnostic {
  code:
    | "syntax"
    | "unsupported"
    | "missing_target_range"
    | "invalid_target_range"
    | "invalid_step_target"
    | "repeat_count_out_of_range";
  message: string;
  token?: string;
}

export class PrescriptionNotationError extends Error {
  diagnostics: ReadonlyArray<PrescriptionDiagnostic>;
  prescribedRun?: { label?: string; localDate?: string };
}
```

- Leverage: high -- structured diagnostics remain available to CLI, tests, and
  future formatting without changing `parsePlan` to a result type.
- Locality: high -- parser still returns diagnostics, Plan loading only wraps
  the failed parse with context.
- Testability: high -- tests can assert `instanceof` and structured fields
  rather than brittle message strings.

**Alternative B -- Change Plan loading to return a result type**

Make Plan parsing non-throwing for prescription failures.

```ts
export type ParsePlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; diagnostics: PlanDiagnostic[] };
```

- Leverage: medium -- callers can inspect errors without exceptions.
- Locality: low -- every existing Plan caller must change or adapt.
- Testability: medium -- structured assertions improve, but unrelated callers
  become part of the migration.

**Alternative C -- Encode prescription failures as custom `ValiError` issues**

Translate parser diagnostics into Valibot issue objects and let existing loader
special-casing handle them.

- Leverage: medium -- reuses an existing error path.
- Locality: lower -- notation diagnostics become coupled to the schema library's
  issue representation.
- Testability: medium -- structured fields may be harder to preserve if Valibot
  issue shape changes.

### Choice

**A (typed prescription error carrying parser diagnostics).** It preserves the
current throwing `parsePlan` contract while keeping parser diagnostics
structured and testable across boundaries.

B is rejected in one sentence: converting Plan parsing to a result type is a
large public contract change for a reliability fix. C is rejected in one
sentence: parser diagnostics should not be forced into a schema-library-specific
shape just to reuse loader formatting.

### Public interface

Entry points:

```ts
export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult;

export class PrescriptionNotationError extends Error {
  diagnostics: ReadonlyArray<PrescriptionDiagnostic>;
}

export function parsePlan(input: unknown): Plan;
export async function loadPlan(path: string): Promise<Plan>;
```

Inputs:

- Authored Prescription Notation string from `prescribed_runs`.
- Prescribed Run context available during Plan parsing: at minimum label and
  local date when present.
- Plan file path available during `loadPlan`.

Outputs:

- Parser failure returns all independent diagnostics it can collect safely.
- `parsePlan` failure throws `PrescriptionNotationError` with structured
  diagnostics.
- `loadPlan` failure includes file path context while preserving the typed
  diagnostic payload where feasible.

Invariants:

- Nested repetition reports `unsupported` with the nested group token.
- The `offset` field is removed from the public `PrescriptionDiagnostic` type;
  callers receive `code`, `message`, and optional `token` only.
- Independent malformed top-level steps can produce multiple diagnostics in one
  parser result.
- Loader message formatting may summarize diagnostics, but tests assert the
  structured diagnostic payload where the public interface exposes it.

Error modes:

- Unsupported nested repetition is not reported as generic `syntax`.
- Multiple bad steps return multiple diagnostics rather than short-circuiting at
  the first top-level failure.
- Plan-loading prescription errors do not lose diagnostic `code`, `token`, or
  location context.

## Acceptance criteria

- Parser tests cover nested repetition and assert an `unsupported` diagnostic.
- Parser tests cover at least two independent malformed top-level steps and
  assert multiple diagnostics are returned.
- The `offset` field is removed from the public `PrescriptionDiagnostic` type
  and from any documentation referencing it.
- `parsePlan` tests assert invalid prescription failures preserve structured
  diagnostic fields, not only message text.
- `loadPlan` tests assert file path context is present for prescription errors.
- Existing Valibot schema-error behavior remains unchanged.
- ADR or AAR note records the Plan-loading decision ratified by this sub-issue:
  `parsePlan` keeps throwing a typed error rather than switching to a
  diagnostic-collection result type. Audit finding #6 on parent #53 frames this
  as a consequential decision.

## Proposed tests

- Parser unit: `2(3min @ E/2(1min @ T/30sec @ R))` reports `unsupported` with a
  useful token or offset.
- Parser unit: `0K @ E[205-234W] -> bad -> 0min @ T[260-280W]` returns multiple
  diagnostics when the invalid parts are independent.
- Parser unit: diagnostics that include offsets point to the expected authored
  substring.
- Plan integration: malformed `prescribed_runs` throws
  `PrescriptionNotationError` with diagnostic `code` and `token` retained.
- Loader integration: loading a bad Plan file includes the file path and keeps
  prescription diagnostic details available for CLI handling or assertions.
- Regression: valid nested-free repetition still parses successfully.

## Affected artifacts

- `packages/engine/src/plan/prescription.ts`
- `packages/engine/src/plan/prescription.test.ts`
- `packages/engine/src/plan/schema.ts`
- `packages/engine/src/plan/loader.ts`
- Plan schema/loader tests
- Public exports if `PrescriptionNotationError` is exposed from
  `@run2max/engine`
- ADR or AAR entry recording the eager-throw vs diagnostic-collection decision
  for `parsePlan` on Prescription Notation failures

## Dependencies

- Upstream: sub-issue #74 defines the hardened diagnostics that must propagate.
- Downstream: parent closure verification depends on this sub-issue proving that
  Plan and loader boundaries remain actionable.
- Independent: sub-issues #76 and #77 do not depend on this interface beyond not
  masking Plan-loading errors.
