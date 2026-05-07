# Plan walker uses eager array context surface

_Made during: 01-deepen-engine / Parent Issue #35 / Sub-Issue #36_
_Scope: product_
_Status: accepted_

The Plan walker is exposed as `walkPlan(plan): readonly WeekContext[]` and is
the single canonical Plan-tree traversal surface for engine and CLI call sites.
This preserves array semantics already used across callers (`findIndex`,
indexing, `map`, `filter`, `slice`) without introducing named reducer wrappers
or lazy-iterator spread overhead.

## Considered Options

- Single eager array primitive (`walkPlan(plan): readonly WeekContext[]`) — accepted.
- Named reducers in addition to walker (`mapWeeks`, `findWeek`, `flattenWeeks`) — rejected as redundant API surface.
- Lazy iterator return (`Iterable<WeekContext>`) — rejected because existing call sites require array semantics.

## Consequences

- New Plan-tree iteration should go through `walkPlan` rather than inline loops.
- Per-call-site derived fields should be computed from `WeekContext`/`ctx.week`
  without adding special-purpose global helpers unless a new cross-call-site
  need is demonstrated.
