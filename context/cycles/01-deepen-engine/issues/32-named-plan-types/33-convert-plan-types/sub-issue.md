# Sub-Issue #33 — Convert Plan-family types to named interfaces

Vertical slice for parent issue #32. Delivers the full parent scope as a
single behaviour-preserving change: define named interfaces, switch public
exports, remove the CLI workaround, and add the drift guard.

## Description

Replace the five `export type X = v.InferOutput<typeof XSchema>` declarations
in `packages/engine/src/plan/schema.ts` with plain named interfaces, decide
where those interfaces live, route public exports through them, update
`parsePlan` to return the named `Plan`, delete the `PlanLike` workaround in
the CLI, and add a type-level drift guard so a future schema edit that
diverges from the named interface fails fast.

The scope is a vertical slice — every concrete acceptance criterion of
parent #32 is closed by this sub-issue. If implementation reveals the slice
is too large, it splits and a new sub-issue is added as a sibling. Today,
only this sub-issue is planned.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| TypeScript compiler | In-process | Test directly: `pnpm typecheck` is the verifying tool. |
| `valibot` runtime parser | In-process | Test directly: existing parser tests remain unchanged. |
| `parsePlan` consumers (engine internals + CLI) | In-process | Test directly through the existing test suite. |
| `vitest` | In-process | Test runner; tests run as-is. |

No remote, collaborator-owned, or external dependencies. No port required —
no second adapter is in play.

## Interface design

The interface that this sub-issue must commit to is the *location* of the
named interfaces and the *signature* of `parsePlan`. The runtime contract of
`parsePlan` does not change.

### Design-it-twice

**Alternative A — Minimal surface: keep interfaces in `plan/schema.ts`**

Define `interface Plan`, `Mesocycle`, `Fractal`, `Week`, `TestingPeriod`
above the existing schema constants in the same file. Replace the
`v.InferOutput` aliases with direct exports of the interfaces.

- Leverage: low — one file changes; no new file in the import graph.
- Locality: high — schema and type sit next to each other, easy to keep in
  sync visually when adding a field.
- Testability: identical to B. The drift-guard test is the same shape either
  way.

**Alternative B — Optimised for common caller: move interfaces to `plan/types.ts`**

Create `packages/engine/src/plan/types.ts` containing the five named
interfaces. `plan/schema.ts` keeps schemas only and imports the interfaces
to type the `parsePlan` return. The engine's `index.ts` re-exports the
interfaces from `plan/types.ts`.

- Leverage: high — `plan/types.ts` becomes the single source for the
  domain's public type model, decoupled from the parser. Future "deepen the
  Plan" work in this cycle (Plan walker etc.) imports from `plan/types.ts`
  without crossing the parser module.
- Locality: medium — schema and interface drift is now caught by a test
  rather than visual proximity. The drift-guard test is the explicit
  enforcement of the boundary.
- Testability: identical to A.

### Choice

**B (separate `plan/types.ts`).** The cycle's stated soul is deepening: one
module, one concept. Mixing schemas and public types in a single file
preserves the v.InferOutput-shaped habit of mind and invites the next
maintainer to repeat the pattern for a new type. A separate `plan/types.ts`
makes the public type model a first-class artifact and lets the parser
module shrink to its single responsibility. The drift-guard test makes the
separation safe.

A is rejected in one sentence: keeping schema and types in one file leaves
v.InferOutput visually adjacent and invites future types to be declared the
same way the cycle is removing.

This decision is a candidate ADR per the cycle PRD's open questions; the
rationale captured here is the seed for that ADR if one is written at
parent close.

### Public interface

```ts
// packages/engine/src/plan/types.ts
export interface TestingPeriod {
  cp?: number;
  eFtp?: number;
  lthr?: number;
  zones?: Record<string, { min: number; max: number }>;
}

export interface Week {
  planned: string;
  start: string;
  executed?: string;
  reason?: string;
  note?: string;
  testingPeriod?: TestingPeriod;
}

export interface Fractal {
  weeks: Week[];
}

export interface Mesocycle {
  name: string;
  fractals: Fractal[];
}

export interface Plan {
  schemaVersion: 1;
  block: string;
  goal?: string;
  distance?: string;
  raceDate?: string;
  start: string;
  mesocycles: Mesocycle[];
}
```

```ts
// packages/engine/src/plan/schema.ts (return type only changes)
export function parsePlan(raw: unknown): Plan { ... }
```

Invariants preserved:
- Optional fields keep the same shape (`?:`) — structurally equivalent to
  the prior `v.InferOutput` of `v.optional(...)`.
- `schemaVersion: 1` is a literal type, matching `v.literal(1)`.
- `mesocycles`, `fractals`, `weeks` are non-empty *at runtime* (enforced by
  the schema's `minLength`); the type system does not encode this. The
  current public type doesn't either, so this is preserved.

Error modes:
- `parsePlan` throws a `valibot` `ValiError` on schema violation, same as
  today.

## Acceptance criteria

- `packages/engine/src/plan/types.ts` exists and exports the five named
  interfaces above.
- `packages/engine/src/plan/schema.ts` no longer declares the public types
  via `v.InferOutput`. It imports them from `./types.js` and uses them to
  type `parsePlan`'s return.
- `packages/engine/src/index.ts` re-exports the five interfaces (the
  existing public API surface for these names is preserved).
- `packages/cli/src/commands/quantify.ts` imports `Plan` directly from
  `@run2max/engine`. The `PlanLike` type and the comment block at lines
  285-304 are deleted. `warnIfPreviousWeekUnsynced` accepts `Plan`.
- `pnpm typecheck` succeeds in `packages/engine` and `packages/cli`. No
  `TS2589` is emitted at any point during the change.
- `pnpm test` succeeds with no test modifications (the runtime parser
  output continues to satisfy the named interfaces structurally).
- A type-level drift-guard test exists (location TBD during
  implementation — likely `packages/engine/src/plan/types.test-d.ts` or a
  small static assertion inside an existing test file). The test fails at
  type-check time if the named `Plan` interface and
  `v.InferOutput<typeof PlanSchema>` diverge.

## Proposed tests

1. **Drift guard (new, type-level)**. Two static assignments verify
   round-trip assignability between the named interface and the schema's
   inferred type for `Plan` (and transitively for the nested types):

   ```ts
   import * as v from "valibot";
   import { PlanSchema } from "./schema.js";
   import type { Plan } from "./types.js";

   const _interfaceFitsSchema = (p: Plan): v.InferOutput<typeof PlanSchema> => p;
   const _schemaFitsInterface = (p: v.InferOutput<typeof PlanSchema>): Plan => p;
   ```

   These compile-time assertions live in a `.ts` file that is part of the
   typecheck pass; they are removed from the runtime build. If a future
   schema edit changes the inferred shape without a matching interface
   update (or vice versa), `pnpm typecheck` fails on these lines.

2. **Existing parser tests pass unchanged**. Any test that exercises
   `parsePlan` (round-trip parsing of a sample `plan.yaml`, schema
   validation errors) must pass without modification. This is the runtime
   evidence that the conversion is behaviour-preserving.

3. **Existing CLI tests pass unchanged**. Any test that exercises the CLI
   `quantify` command with a `--plan` argument or with auto-discovered
   `plan.yaml` must pass without modification. This is the integration
   evidence that the `PlanLike` removal didn't regress runtime behaviour.

4. **No new behavioural test is added.** This sub-issue is a refactor; new
   behaviour would be scope drift. If during implementation a gap in
   existing test coverage is discovered (e.g., a code path that the current
   suite doesn't exercise but the change touches), record the gap as a flag
   on parent #32 rather than expanding this sub-issue.

## Affected artifacts

- `packages/engine/src/plan/schema.ts` — remove the five `v.InferOutput`
  type aliases; import named types from `./types.js`; update `parsePlan`
  return type.
- `packages/engine/src/plan/types.ts` — **new file**, holds the five named
  interfaces.
- `packages/engine/src/plan/types.test-d.ts` (or equivalent) — **new file**,
  contains the drift-guard type-level assertions.
- `packages/engine/src/index.ts` — re-exports the five types from
  `plan/types.js` instead of from `plan/schema.js` (or via schema.ts which
  re-exports them; both are acceptable as long as the public API surface is
  unchanged).
- `packages/cli/src/commands/quantify.ts` — delete the `PlanLike` type
  declaration and the 14-line `TS2589` comment block (lines 285-304); change
  `warnIfPreviousWeekUnsynced`'s `plan` parameter type from `PlanLike` to
  `Plan` (imported from `@run2max/engine`).

## Dependencies

- Upstream sub-issues: none. First sub-issue of the first parent of the
  cycle.
- External services: none.
- Test fixtures: existing fixtures are reused unchanged. No new fixtures
  required.
