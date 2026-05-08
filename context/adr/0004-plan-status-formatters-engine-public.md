# Plan-status formatters live in engine formatters and remain engine-public

_Made during: 01-deepen-engine / Parent Issue #41 / Sub-Issue #42_
_Scope: product_
_Status: accepted_

Plan-status rendering functions `formatDefaultView` and `formatFullView` move
to `packages/engine/src/formatters/plan.ts` and remain exported from the
engine's public surface via `packages/engine/src/index.ts`.

## Considered Options

- Engine formatter module re-exported from engine index -- accepted.
- CLI-local formatter module (`packages/cli/src/commands/plan/format.ts`) -- rejected because it moves an existing shared surface across package boundaries now, then likely requires a second move when a second consumer appears.
- Engine formatter module with sub-path-only exposure -- rejected because it introduces multi-entrypoint public-surface decisions that belong to the later index-surface regrouping work.

## Consequences

- `packages/engine/src/plan/status.ts` remains computation-only and does not
  export rendering helpers.
- `packages/engine/src/formatters/plan.ts` owns rendering behavior and depends
  on `PlanStatus` from `plan/status.ts`.
- CLI imports remain unchanged on `@run2max/engine`, preserving behavior while
  keeping presentation and logic separated by module boundary.
