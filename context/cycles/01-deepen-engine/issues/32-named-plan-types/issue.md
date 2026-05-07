# Parent Issue #32 — Named Plan domain interfaces

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- `Plan`, `Mesocycle`, `Fractal`, `Week`, and `TestingPeriod` are exported
  from `@run2max/engine` as plain named TypeScript interfaces. No public type
  is declared as `v.InferOutput<typeof XSchema>`.
- `parsePlan(raw: unknown)` continues to validate against `PlanSchema` at
  runtime and returns a value whose static type is the named `Plan` interface.
- The `PlanLike` structural-subtype workaround in
  `packages/cli/src/commands/quantify.ts` is deleted, including the 14-line
  comment block (`cli/src/commands/quantify.ts:285-304`). `Plan` is imported
  directly from `@run2max/engine`.
- Repository-runnable verification commands succeed across the workspace (at
  minimum `pnpm test`), and no `TS2589` workaround is required in engine or
  CLI consumers.
- All existing tests pass without behavioural modification. The runtime
  output of `parsePlan` continues to satisfy every existing assertion.
- A type-level drift guard exists: a test (or a `// @ts-expect-error`-aware
  assertion) verifies that values of `v.InferOutput<typeof PlanSchema>` are
  assignable to the named `Plan` interface and vice versa. If a future
  schema edit breaks this assignability, the test fails fast.
- After this parent closes, no engine module re-introduces `v.InferOutput`
  as a *public* type for these five concepts. (Internal use of `v.InferOutput`
  inside `plan/schema.ts` for type-level checks is fine.)

## Implementation approach

1. Decide where the named interfaces live (next to schemas in `plan/schema.ts`,
   or in a separate `plan/types.ts`). Make this decision through
   design-it-twice in sub-issue #33; record the rejected alternative and the
   reason.
2. Define `interface Plan`, `interface Mesocycle`, `interface Fractal`,
   `interface Week`, `interface TestingPeriod` matching the runtime output of
   their respective schemas. Optional fields keep the same shape they have
   today (`field?: T` semantics matching `v.optional(...)`).
3. Update the public `export type X = ...` lines to export the named
   interfaces instead of `v.InferOutput<...>`.
4. Update `parsePlan` so its return type is the named `Plan`. The runtime
   value comes from `v.parse(PlanSchema, ...)`; the boundary cast is
   justified by the drift-guard test.
5. Delete the `PlanLike` type and the 14-line `TS2589` explanatory comment
   from `packages/cli/src/commands/quantify.ts`. Replace the `PlanLike`
   parameter on `warnIfPreviousWeekUnsynced` with `Plan` imported from the
   engine.
6. Add the type-level drift guard. Run the full test suite using
   repository-runnable verification commands (currently `pnpm test`). Confirm
   `TS2589` is absent both before and after the `PlanLike` deletion.

If during implementation the work decomposes into more than one vertical
slice, additional sub-issues are added as siblings to #33. Today only #33 is
planned.

## Dependencies

- Upstream: none. This is the cycle's foundation.
- External: `valibot` stays as the runtime parser. No version change. No
  swap to a different validation library.
- Tooling: `pnpm test` / `vitest` for repository-runnable verification.

## Flags

- For future parent issues in this cycle: import `Plan`, `Mesocycle`,
  `Fractal`, `Week`, `TestingPeriod` directly from `@run2max/engine`. Do not
  reintroduce a structural subtype workaround. If a new context requires a
  narrowed shape, add an explicit named type (e.g. `WeekRef`) — never a
  `PlanLike` shadow.
- The decision on where the named interfaces live is a candidate ADR
  ("valibot inferred types are not public types"). Capture rationale in the
  sub-issue's design-it-twice record; if the rationale is durable and the
  decision is hard to reverse, escalate to ADR per the cycle PRD's open
  questions.
- The drift-guard test is the contract that keeps schema and interface in
  sync. Removing it is a drift signal — flag any future PR that does so.

- [x] [33-convert-plan-types -> 32-named-plan-types] -- resolved at parent close; acceptance/verification language updated to avoid non-runnable `pnpm typecheck` references.

  Sub-issue #33 closure found that `pnpm typecheck` is not an executable
  workspace command in this repository. Parent-level acceptance criteria and
  verification notes should reference runnable typecheck commands (or add a
  canonical `typecheck` script) so closure checks are reproducible.

  Files to review:
  - context/cycles/01-deepen-engine/issues/32-named-plan-types/issue.md

  (See source AAR for full context)
