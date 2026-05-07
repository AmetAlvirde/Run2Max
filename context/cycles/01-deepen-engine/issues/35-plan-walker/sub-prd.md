# Parent Issue #35 — Plan walker primitive

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Establish a single Plan-walking primitive (or a small named set of primitives)
in `@run2max/engine` that every call site currently re-flattening or
re-iterating the Plan tree consumes. Replaces the inline duplications already
catalogued in the cycle PRD:

- `flattenWeeks` defined twice — `packages/engine/src/plan/adjust.ts:56` and
  `packages/engine/src/plan/sync.ts:44`.
- The manual three-level `for (const meso of plan.mesocycles) { for (const
  fractal of meso.fractals) { for (const week of fractal.weeks) … } }` loops
  in `packages/engine/src/plan/status.ts`, `packages/engine/src/plan/validate.ts`,
  and `packages/engine/src/plan/reconcile.ts`.
- The `plan.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks))`
  chains in `packages/engine/src/plan/adjust.ts`, `packages/engine/src/plan/build.test.ts`,
  `packages/engine/src/plan/reconcile.test.ts`, and
  `packages/engine/src/plan/templates/builtin.test.ts`.

This is the second cycle foundation parent. Parent #32 stabilised the named
interfaces those walker callers consume. Every later parent in the cycle
(split aggregator, engine/presentation split, helper consolidation) imports
the walker shape that this parent settles, so its public shape needs to be
chosen carefully and changed rarely after this parent's AAR closes.

## Owned user stories

From the cycle PRD:

- As a maintainer adding a feature that walks the Plan tree, I import one
  walker primitive and receive each Week with mesocycle / fractal context
  attached, so I do not write the fifth `flattenWeeks`.

## Encounter statements affecting this scope

- A maintainer opening `packages/engine/src/index.ts` first encounters a
  shorter, domain-grouped export list whose top-level groupings match
  `ubiquitous-language.md` (Periodization, Runs and capture, Metrics and
  zones, Analysis output). The walker primitive(s) live under the
  Periodization grouping.
- A maintainer opening any of `plan/adjust.ts`, `plan/sync.ts`,
  `plan/status.ts`, `plan/validate.ts`, or `plan/reconcile.ts` first
  encounters direct walker usage, not a private `flattenWeeks` re-implementation.

## Directional dependencies on other sub-PRDs

- Upstream: parent #32 (closed) — the named `Plan`, `Mesocycle`, `Fractal`,
  `Week`, and `TestingPeriod` interfaces are the stable input/output types of
  the walker. Re-opening #32 is a drift signal per the cycle PRD.
- Downstream: every later parent issue in this cycle that walks the Plan tree
  consumes the walker shape this parent stabilises. After this parent's AAR
  closes, the walker's public surface is stable for the rest of the cycle and
  re-opening it is a drift signal.

## Domain language

No new domain terms. The walker operates over the existing glossary:
**Plan**, **Mesocycle**, **Fractal**, **Week**. The "context" attached to
each yielded Week (mesocycle name, fractal index within mesocycle, absolute
1-based week index, total weeks) is a presentation of relationships already
defined in `ubiquitous-language.md` — not a new concept. If during
implementation a new exposed term emerges (e.g. a name for the per-Week
context record), validate via `sdp-domain-validate` before closing the
sub-issue.
