# Parent Issue #35 — Plan walker primitive

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- A single Plan-walking primitive (or a small named set of primitives) is
  exported from `@run2max/engine` and used by every Plan-tree iteration site
  in the engine and CLI. The primitive yields each Week with its surrounding
  context attached: at minimum the mesocycle (name and 0-based index), the
  fractal (0-based index within the mesocycle and total fractals in the
  mesocycle), the 0-based week index within the fractal, and the 1-based
  absolute week index across the whole Plan.
- The two private `flattenWeeks` helpers (`packages/engine/src/plan/adjust.ts:56`
  and `packages/engine/src/plan/sync.ts:44`) are deleted. Their callers use
  the public walker; any per-call-site fields not provided by the walker
  context are derived locally from the walker's output, not by re-walking
  the Plan.
- The manual three-level loops in `packages/engine/src/plan/status.ts`,
  `packages/engine/src/plan/validate.ts`, and
  `packages/engine/src/plan/reconcile.ts` are replaced by walker usage. The
  `plan.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks))` chains
  in `adjust.ts`, `build.test.ts`, `reconcile.test.ts`, and
  `templates/builtin.test.ts` are replaced by the walker (or its
  array-returning counterpart, if the chosen design exposes one).
- Zero call sites re-implement Plan-tree flattening after this parent closes.
  Verified by grep for `flattenWeeks`, `for.*plan\.mesocycles`,
  `mesocycles\.flatMap`, and `\.fractals\.flatMap` outside the walker module.
- All existing tests pass without behavioural modification. Output of
  `quantify`, `plan status`, `plan adjust`, `plan sync`, and `plan validate`
  for existing fixtures stays byte-identical.
- The walker's public surface and shape decision are captured in the
  sub-issue's design-it-twice record. The cycle PRD's `MUST RESOLVE` open
  question on iterator-vs-named-reducers is answered there with a
  one-sentence rejection rationale for the alternative.
- Engine public exports under the Periodization grouping include the walker
  primitive(s). No additional helpers leak: any per-walker derived field
  (e.g. `absoluteIndex`) is part of the walker context, not a separate
  exported helper.
- TypeScript strict mode stays on. `TS2589` does not regress. The named
  interfaces from parent #32 remain the walker's input/output types — no
  re-introduction of `v.InferOutput` or a `PlanLike` shadow.

## Implementation approach

1. In sub-issue #36, design-it-twice the walker's public surface. At
   minimum compare:
   - Alternative A — single iterator: `walkPlan(plan): Iterable<WeekContext>`,
     callers use `for (const ctx of walkPlan(plan))` and compose their own
     `map` / `find` / `filter` / `toArray` over it. Smallest API surface;
     callers carry the most weight.
   - Alternative B — small object of named reducers: e.g.
     `walkPlan` (iterator), `mapWeeks(plan, fn)`, `findWeek(plan, predicate)`,
     `flattenWeeks(plan)`. Optimised for the common caller shapes catalogued
     in this parent's scope.
   Record the chosen design and a one-sentence rejection rationale for the
   other in the sub-issue. If the strongest intended encounter (Alternative
   C, experience-heavy) is not relevant here, record that explicitly so the
   skill checklist is satisfied.
2. Define the `WeekContext` shape (or whichever name the design lands on)
   alongside the walker. The shape must be sufficient to serve every call
   site listed above without follow-up re-walking.
3. Implement the walker in a single module under
   `packages/engine/src/plan/`. Decide between adding to `plan/types.ts`
   versus a new `plan/walk.ts` (or similar) during sub-issue interface
   design; record the rejected alternative.
4. Migrate engine call sites in dependency order: `adjust.ts`, `sync.ts`,
   `status.ts`, `validate.ts`, `reconcile.ts`, then any remaining tests
   (`build.test.ts`, `reconcile.test.ts`, `templates/builtin.test.ts`).
   Behavior is preserved at each step; run the full test suite at each
   migration boundary.
5. Migrate CLI call sites that flatten the Plan tree (notably
   `packages/cli/src/commands/plan/sync.ts` and `quantify.ts`) to consume
   the walker directly.
6. Export the walker primitive(s) from `packages/engine/src/index.ts` under
   the Periodization grouping. Ensure no helper leaks beyond what the
   chosen design intends.
7. Run `pnpm test` and confirm byte-identical output for `quantify` and
   `plan` commands against existing fixtures. Confirm `TS2589` is absent.

If during implementation the migration decomposes into more than one
vertical slice (e.g. design+implement separately from full call-site
migration), additional sub-issues are added as siblings to #36.

## Dependencies

- Upstream: parent #32 (closed). The named `Plan`, `Mesocycle`, `Fractal`,
  `Week`, and `TestingPeriod` interfaces are the walker's input/output
  types. No re-opening.
- External: `valibot` stays untouched — the walker operates on already-parsed
  Plans. No version change.
- Tooling: `pnpm test` / `vitest` for repository-runnable verification.
  (`pnpm typecheck` is not a defined workspace command per parent #32's
  closure flag — do not introduce that requirement here.)

## Flags

- Once this parent closes, the walker's public surface is stable for the
  rest of the cycle. Later parent issues that walk the Plan tree must
  import the walker rather than re-introducing inline iteration. A new PR
  reintroducing a private `flattenWeeks` is a drift signal — flag it.
- The walker shape decision is captured as ADR 0001 in
  `context/adr/0001-plan-walker-eager-array-surface.md`.
- The cycle PRD's `MUST RESOLVE` open question on iterator-vs-reducers is
  answered by sub-issue #36's design-it-twice record. After this parent
  closes, update `context/cycles/01-deepen-engine/prd.md` to reflect the
  resolution.
- If migration reveals a per-call-site need that the walker context cannot
  satisfy without ad-hoc post-processing (e.g. a frontier-aware index that
  is `adjust`-specific), prefer adding a narrowly-named helper next to the
  caller over widening the walker context. Widening is a drift signal in
  later parents — flag it.

- [ ] [36-implement-plan-walker -> 35-plan-walker]

  Parent closure still needs explicit fixture byte-identity verification for
  `quantify`, `plan status`, `plan adjust`, `plan sync`, and `plan validate`
  outputs, or a documented rationale if equivalent coverage already exists.

  Files to review:
  - context/cycles/01-deepen-engine/issues/35-plan-walker/36-implement-plan-walker/aar.md

  (See source AAR for full context)
