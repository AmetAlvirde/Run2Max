# Plan-family interfaces live in `plan/types.ts`

_Made during: 01-deepen-engine / Parent Issue #32 / Sub-Issue #33_
_Scope: product_
_Status: accepted_

The public Plan-family types (`Plan`, `Mesocycle`, `Fractal`, `Week`,
`TestingPeriod`) are defined as named interfaces in
`packages/engine/src/plan/types.ts`, while `plan/schema.ts` owns parser/schema
concerns. This keeps domain type ownership separate from schema inference and
supports deeper module locality for downstream Plan work.

## Considered Options

- Keep interfaces in `plan/schema.ts` near valibot schemas — rejected.
- Move interfaces to standalone `plan/types.ts` and import where needed — accepted.

## Consequences

- Callers import Plan-family types from `plan/types.ts` (via engine public exports)
  without coupling to parser internals.
- Schema/type drift is enforced by a type-level guard
  (`packages/engine/src/plan/types.test-d.ts`) rather than file co-location.
