# Parent Issue #32 — Named Plan domain interfaces

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Replace the `v.InferOutput`-derived public types for `Plan`, `Mesocycle`,
`Fractal`, `Week`, and `TestingPeriod` with plain named TypeScript interfaces.
Stop exposing valibot's inferred types as the engine's public API. Delete the
`PlanLike` structural-subtype workaround in `packages/cli/src/commands/quantify.ts`
and the 14-line `TS2589` explanatory comment that accompanies it.

This is the cycle's deepest foundation parent: every later parent in the
cycle (Plan walker, split aggregator, engine/presentation split, helper
consolidation) imports one or more of these types. Their stable shape needs
to settle first.

## Owned user stories

From the cycle PRD:

- As a maintainer importing `Plan` from the engine in a new module, I get a
  plain named interface and TypeScript does not error with `TS2589`, so I do
  not need to invent a `PlanLike` shadow type.

## Encounter statements affecting this scope

- A maintainer opening `packages/cli/src/commands/quantify.ts` first
  encounters direct imports from `@run2max/engine` with no `PlanLike`
  workaround and no fourteen-line comment about `TS2589`.

## Directional dependencies on other sub-PRDs

- Upstream: none. This is a foundation parent; nothing in the cycle blocks it.
- Downstream: every later parent issue in this cycle that imports `Plan`,
  `Mesocycle`, `Fractal`, `Week`, or `TestingPeriod` consumes the interfaces
  this parent stabilises. After this parent's AAR closes, those interfaces
  are stable for the rest of the cycle and re-opening them is a drift signal
  (per the cycle PRD).

## Domain language

No new domain terms are introduced. The interfaces are direct in-code
representations of glossary terms (**Plan**, **Mesocycle**, **Fractal**,
**Week**, **Testing Period**) already validated in `ubiquitous-language.md`.
The fact that **Plan** is now a glossary term distinct from **Block** is
exactly what makes "named Plan domain interfaces" the right framing — the
interfaces map one-to-one onto the glossary entries that exist for these
concepts.
