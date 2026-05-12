# Sub-Issue #58 -- Wire the CLI Prescribed Run override

Vertical slice for parent #56. Delivers the `run2max quantify` access surface
for choosing an intended Prescribed Run and maps that CLI input to the existing
`QuantifyOptions.prescribedRunOverride` contract from sub-issue #57.

## Description

Add a `quantify` CLI flag that lets a runner override Prescribed Run association
when a Run moved dates or the default local-date match is ambiguous. The CLI
parses a single selector value and passes a structured override into the engine;
the engine remains responsible for finding a unique Prescribed Run or reporting
an unavailable association.

When `--prescribed-run` is supplied without `--plan`, the CLI should
optimistically load `plan.yaml` from the current working directory. If no cwd
Plan exists, fail clearly and tell the runner to pass `--plan <path>` for a Plan
stored elsewhere. Normal `quantify` runs without `--prescribed-run` keep the
existing silent Plan auto-discovery behavior.

The planned flag is `--prescribed-run <selector>`. Selector rules are:

- `YYYY-MM-DD` maps to `{ overrideDate: "YYYY-MM-DD" }`.
- `date:YYYY-MM-DD` maps to `{ overrideDate: "YYYY-MM-DD" }`.
- `label:<label>` maps to `{ overrideLabel: "<label>" }`.
- Any other non-empty value maps to `{ overrideLabel: "<value>" }`.

The `label:` prefix is the escape hatch for date-shaped labels such as
`2026-05-12`. This keeps the common caller path short while avoiding an
unresolvable ambiguity for labels that look like dates.

Out of scope: changes to `findPrescribedRun`, Plan parsing, lap comparison,
formatter output, unavailable reason prose, history artifact lookup, and any
database/cache/config schema behavior.

## Dependency classification

| Dependency                                                     | Category            | Testing strategy                                                                                                                          |
| -------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `citty` command argument handling                              | In-process          | Add the new command arg and test the parser/helper behavior with direct inputs; rely on existing command wiring patterns for `args` keys. |
| CLI `quantify` command option construction                     | In-process          | Assert the parsed selector is included in the object passed to engine `quantify` when present and omitted when absent.                    |
| `QuantifyOptions.prescribedRunOverride` from `@run2max/engine` | In-process          | Type-check the CLI mapping against the exported engine option shape and cover it through CLI tests/build.                                 |
| `loadPlan` Plan discovery/loading behavior                     | Local-substitutable | Use temporary local fixtures or mocked loader behavior in CLI tests; when override is supplied, prefer `--plan`, then cwd `plan.yaml`, then fail clearly. |
| Engine `quantify` behavior from sub-issue #57                  | In-process          | Do not retest association outcomes here; assert only that the CLI passes the structured override through.                                 |
| Node filesystem reads for FIT/config/Plan/output files         | Local-substitutable | Existing command flow already uses local files; any new test should use temporary files or module mocks rather than real user paths.      |

No remote-owned, collaborator-owned, true external, or irreplaceable dependency
is introduced. No port is needed because this slice is a local CLI-to-engine
option mapping with no second adapter.

## Interface design

The interface this sub-issue commits to is the CLI selector syntax and its
mapping to `QuantifyOptions.prescribedRunOverride`. It does not add a new engine
public API.

### Design-it-twice

**Alternative A -- Minimal direct engine flags**

Expose the structured engine fields directly as two CLI flags.

```ts
args: {
  "prescribed-run-date": { type: "string" },
  "prescribed-run-label": { type: "string" },
}

// CLI mapping
prescribedRunOverride: {
  overrideDate: args["prescribed-run-date"],
  overrideLabel: args["prescribed-run-label"],
}
```

- Leverage: medium -- it exposes the full engine shape, including date and label
  together, but makes the common moved-Run command longer.
- Locality: high -- mapping is nearly mechanical and stays inside the CLI
  command.
- Testability: high -- each flag maps directly to one field.

**Alternative B -- Single selector optimized for common caller**

Expose one `--prescribed-run <selector>` flag. Date-shaped selectors map to an
override date; other selectors map to an override label. Prefixes provide
explicit typing when needed.

```ts
args: {
  "prescribed-run": {
    type: "string",
    description:
      "Prescribed Run override: YYYY-MM-DD, date:YYYY-MM-DD, label:<label>, or label text",
  },
}

type CliPrescribedRunOverride =
  | { overrideDate: string; overrideLabel?: never }
  | { overrideLabel: string; overrideDate?: never };

function parsePrescribedRunOverride(
  value: string | undefined,
): CliPrescribedRunOverride | undefined;
```

Example caller shape:

```sh
run2max quantify runs/wednesday.fit --prescribed-run "Tuesday Intervals"
run2max quantify runs/wednesday.fit --prescribed-run 2026-05-12
run2max quantify runs/wednesday.fit --plan . --prescribed-run label:2026-05-12
```

- Leverage: high -- one flag covers the normal date and label overrides while
  preserving an escape hatch for date-shaped labels.
- Locality: high -- all selector parsing lives in the CLI command before the
  existing engine option boundary.
- Testability: high -- parsing can be tested as a small pure helper, and command
  tests only need to assert option pass-through.

**Alternative C -- Explicit selector grammar only**

Require every value to be typed with a prefix, such as `date:2026-05-12` or
`label:Tuesday Intervals`, and reject bare values.

```sh
run2max quantify runs/wednesday.fit --plan . --prescribed-run date:2026-05-12
run2max quantify runs/wednesday.fit --plan . --prescribed-run label:Tuesday Intervals
```

- Leverage: medium -- the syntax is unambiguous and extensible, but it makes the
  common path more ceremony than this cycle needs.
- Locality: high -- selector parsing remains local to the CLI command.
- Testability: high -- invalid selectors are easy to reject deterministically.

### Choice

**B (single selector optimized for common caller).** It is the smallest user
surface that supports moved Runs by date or label and still gives date-shaped
labels an explicit `label:` escape hatch.

A is rejected in one sentence: exposing two flags mirrors the engine but makes
the common moved-Run command unnecessarily verbose. C is rejected in one
sentence: requiring prefixes for every override optimizes for parser purity over
the runner's most common command shape.

### Public interface

CLI entry point:

```sh
run2max quantify <fit-file> --prescribed-run <selector>
run2max quantify <fit-file> --plan <plan-path-or-dir> --prescribed-run <selector>
```

Selector inputs:

- Bare `YYYY-MM-DD`: authored Prescribed Run `localDate`.
- `date:YYYY-MM-DD`: explicit authored Prescribed Run `localDate`.
- `label:<label>`: exact authored Prescribed Run `label`, including labels that
  look like dates.
- Bare non-date text: exact authored Prescribed Run `label`.

Engine output passed by the CLI:

```ts
prescribedRunOverride?: {
  overrideDate?: string;
  overrideLabel?: string;
}
```

Invariants:

- The CLI parser only chooses date versus label; it does not search the Plan.
- Label matching remains exact and case-sensitive because the engine owns match
  semantics.
- The selector is passed only as structured engine input; the CLI does not call
  `findPrescribedRun` directly.
- `planContext` remains date-based. A cross-Week override must not redefine the
  existing Week Plan Context.
- A supplied override requires a loaded Plan. If `--plan` is absent, try
  `plan.yaml` in the current working directory before failing.
- Existing no-override Plan discovery remains unchanged and silent when no Plan
  is found.
- The CLI does not expose both `overrideDate` and `overrideLabel` simultaneously
  in this slice. Ambiguity after a single selector remains an engine association
  result for downstream comparison/formatting work.

Error modes:

- Blank `--prescribed-run` values fail with a CLI validation error.
- `date:` with a non-`YYYY-MM-DD` value fails with a CLI validation error.
- `label:` with an empty label fails with a CLI validation error.
- Bare `YYYY-MM-DD` is treated as a date-shaped selector. To select a label with
  that exact text, the runner must use `label:YYYY-MM-DD`.
- A supplied override with no explicit Plan and no cwd `plan.yaml` fails with a
  CLI validation error that tells the runner to pass `--plan <path>`.

## Acceptance criteria

- `run2max quantify` exposes `--prescribed-run <selector>` in
  `packages/cli/src/commands/quantify.ts` help metadata.
- Bare `YYYY-MM-DD` and `date:YYYY-MM-DD` selectors map to
  `prescribedRunOverride.overrideDate`.
- Bare non-date text and `label:<label>` selectors map to
  `prescribedRunOverride.overrideLabel`.
- `label:YYYY-MM-DD` is preserved as an override label, not coerced to an
  override date.
- Blank selector values, empty `label:` values, and malformed `date:` values
  fail before calling engine `quantify`.
- When `--prescribed-run` is supplied without `--plan`, the command attempts to
  load `plan.yaml` from the current working directory before calling engine
  `quantify`.
- When `--prescribed-run` is supplied and neither `--plan` nor cwd `plan.yaml`
  is available, the command fails before calling engine `quantify` with an error
  that mentions no Plan was found in cwd and suggests `--plan <path>`.
- When a Plan is loaded, the CLI passes the parsed override into
  `quantify(..., { prescribedRunOverride })` without changing any other quantify
  options.
- Existing behavior without `--prescribed-run` remains unchanged; no override
  field is passed unless the flag is supplied.
- No changes are made to `findPrescribedRun`, `AnalysisResult`, formatter
  output, lap comparison, history comparison, or Plan schema.
- The parent issue and cycle PRD open question are updated at closure to record
  the accepted `--prescribed-run` selector syntax.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and `pnpm build`.

## Proposed tests

1. **Bare date selector** -- parsing `2026-05-12` returns
   `{ overrideDate: "2026-05-12" }`.
2. **Explicit date selector** -- parsing `date:2026-05-12` returns
   `{ overrideDate: "2026-05-12" }`.
3. **Bare label selector** -- parsing `Tuesday Intervals` returns
   `{ overrideLabel: "Tuesday Intervals" }`.
4. **Explicit label selector** -- parsing `label:Tuesday Intervals` returns
   `{ overrideLabel: "Tuesday Intervals" }`.
5. **Date-shaped label selector** -- parsing `label:2026-05-12` returns
   `{ overrideLabel: "2026-05-12" }`.
6. **Malformed explicit date** -- parsing `date:Tuesday Intervals` fails with a
   validation error.
7. **Blank selector** -- blank or whitespace-only values fail with a validation
   error.
8. **CLI pass-through** -- a `quantify` command invocation with a loaded Plan
   and `--prescribed-run` calls engine `quantify` with the parsed
   `prescribedRunOverride`.
9. **Cwd Plan fallback** -- a supplied `--prescribed-run` without `--plan` loads
   `plan.yaml` from the current working directory and passes that Plan plus the
   parsed override to engine `quantify`.
10. **No Plan failure** -- a supplied `--prescribed-run` with neither explicit
    Plan nor cwd `plan.yaml` fails before calling engine `quantify` and suggests
    `--plan <path>`.
11. **No flag unchanged** -- a normal `quantify` command invocation does not
     pass `prescribedRunOverride`.
12. **Build/type smoke** -- CLI build succeeds against the engine's exported
     `QuantifyOptions` shape.

## Affected artifacts

- `packages/cli/src/commands/quantify.ts` -- add the CLI flag, selector parsing,
  validation, no-Plan guard, and `quantify` option mapping.
- `packages/cli/src/commands/quantify.test.ts` -- add focused tests for selector
  parsing and command pass-through behavior. If direct command testing proves
  too coupled, extract a small local helper from `quantify.ts` and test that
  helper plus a narrow command smoke test.
- `packages/cli/README.md` -- document the new `--prescribed-run` selector only
  if the README lists `quantify` options today.
- `context/cycles/02-run-prescriptions-and-comparisons/prd.md` -- mark the CLI
  override open question resolved at sub-issue closure.
- `context/cycles/02-run-prescriptions-and-comparisons/issues/56-run-prescription-association/issue.md`
  -- replace the carry-forward flag with closure notes once implemented.

## Dependencies

- Sub-issue #57 must remain closed and provides the existing structured engine
  option `QuantifyOptions.prescribedRunOverride`.
- Parent #56 remains the active parent scope for Prescribed Run association.
- The CLI must prefer the parsed Plan loaded by `--plan`; when only
  `--prescribed-run` is supplied, it may add the narrow cwd `plan.yaml` fallback
  needed to avoid forcing `--plan .`.
- The engine remains the source of truth for matching, ambiguity, and no-match
  outcomes.
- Do not add FIT lap comparison, formatter output, unavailable prose, history
  artifact lookup, database/cache behavior, or config schema changes.
