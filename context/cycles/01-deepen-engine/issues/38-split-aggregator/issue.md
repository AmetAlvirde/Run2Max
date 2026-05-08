# Parent Issue #38 — Split-aggregation primitive

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- A single split-aggregation primitive is exported from `@run2max/engine`
  and consumed by `computations/segments.ts`, `computations/km-splits.ts`,
  and `computations/dynamics.ts`. The primitive is parameterised by
  bucketing input only — the aggregation logic itself (Tier-2 / Tier-3
  capability gating, derived metrics, average vs weighted-average choice)
  lives in one module.
- The Tier-2 averaging block (`stanceTime`, `stanceTimeBalance`,
  `stepLength`, `verticalOscillation`) appears once in the codebase. The
  Tier-3 averaging block (`formPower`, `airPower`, plus dynamics-only
  `legSpringStiffness` / `legSpringStiffnessBalance` /
  `verticalOscillationBalance`) appears once. The derived-metric
  expressions for `verticalRatio` and `formPowerRatio` appear once.
- The two private `weightedAvg` (`computations/km-splits.ts:92`) and
  inline-`avg`-mapping (`computations/segments.ts:79-117`,
  `computations/dynamics.ts:17-77`) idioms are deleted from their
  call-site files. Each call site retains only its bucketing logic and
  a call into the shared aggregator.
- `SegmentRow`, `KmSplitRow`, and `DynamicsSummary` shapes in
  `packages/engine/src/types.ts` are unchanged. The aggregator produces
  the same field set each call site produces today — no new fields, no
  removed fields, no rename. Output of `quantify` against existing
  fixtures stays byte-identical.
- The aggregator handles the unweighted case (segments, dynamics) and
  the weighted case (km-splits) without forking on a boolean — weight
  is part of the input shape, defaulting to `1` for unweighted callers.
  Weighted-average and arithmetic-average semantics are unified at the
  aggregator's boundary.
- The aggregator does not own bucket discovery. Lap-time-windowing
  (segments), km-distance-windowing with fractional weights (km-splits),
  and single-bucket (dynamics) bucketing logic stays in each respective
  computation module. The aggregator's input is already-bucketed.
- The cycle PRD's `MUST RESOLVE` open question — "shape of the unified
  split-aggregator parameter: `bucketBy` strategy function vs pre-bucketed
  `Slice[]` input" — is answered in sub-issue #39's design-it-twice
  record with a one-sentence rejection rationale for the alternative.
- All existing tests pass without behavioural modification:
  `computations/segments.test.ts`, `computations/km-splits.test.ts`,
  `computations/dynamics.test.ts`, `computations/quantify.test.ts`,
  the engine smoke test, and CLI command tests. Workspace-level
  `pnpm test` is green.
- TypeScript strict mode stays on. `TS2589` does not regress.
- Engine public exports under the Analysis output grouping include the
  aggregator primitive and any shared input/output types it requires.
  No additional helpers leak: any per-call-site post-processing (e.g.
  filling `windSpeed`/`windDirection`/`temperature` from weather data)
  stays at the call site.

## Implementation approach

1. In sub-issue #39, design-it-twice the aggregator's public surface.
   At minimum compare:
   - Alternative A — **pre-bucketed input**: the aggregator takes
     `WeightedRecord[]` (a bucket) plus an aggregation config and
     returns the aggregated row for that bucket. Callers do their own
     bucketing and call the aggregator once per bucket.
   - Alternative B — **`bucketBy` strategy**: the aggregator takes the
     full `Run2MaxRecord[]` plus a `bucketBy` function returning bucket
     keys, performs the bucketing, and returns one row per bucket.
   Record the chosen design and a one-sentence rejection rationale for
   the other. The sub-PRD records a pre-resolution preference for A;
   the design-it-twice must reach its own decision rather than ratify
   the preference.
2. Define the aggregator's input record shape (likely something like
   `WeightedRecord = { record: Run2MaxRecord; weight: number }`) and
   the output shape contract. The output shape is a *superset* of the
   shared field set; per-call-site fields not produced by the
   aggregator (`lapIndex`, `km`, `distance`, `duration`, `avgPace`,
   elevation, weather null-placeholders) are added by the call site
   after aggregation.
3. Implement the aggregator in a single module. Decide between adding
   to `computations/utils.ts` versus a new
   `computations/aggregate.ts` (or similar) during sub-issue interface
   design; record the rejected alternative.
4. Migrate call sites in dependency order:
   1. `computations/dynamics.ts` first — single-bucket case is the
      simplest consumer and a useful smoke for the aggregator's shape.
   2. `computations/segments.ts` — unweighted multi-bucket. Bucketing
      logic (lap time-windowing) stays. The aggregator replaces the
      Tier-2 / Tier-3 / derived-metrics block.
   3. `computations/km-splits.ts` — weighted multi-bucket. Bucketing
      logic (km distance-windowing with fractional weights) stays.
      Per-bucket `WeightedRecord` construction stays at the call site.
      The aggregator replaces `weightedAvg` and the field-by-field
      averaging block.
5. After each migration, run the relevant test file and confirm green
   before moving to the next call site. Confirm fixture byte-identity
   for `quantify` output against the existing engine fixtures at the
   end of the migration.
6. Export the aggregator primitive (and any shared input/output types)
   from `packages/engine/src/index.ts` under the Analysis output
   grouping.
7. Run `pnpm test` at the workspace root and confirm green.

If during implementation the migration decomposes into more than one
vertical slice (e.g. dynamics-first as a tracer bullet, then segments
and km-splits in a second slice), additional sub-issues are added as
siblings to #39.

## Dependencies

- Upstream: parent #32 (closed) — named Plan-family interfaces are not
  on this path, but the engine's domain-type discipline established
  there extends to the aggregator's input/output types: no
  `v.InferOutput` chains, no structural-subtype workarounds.
- Upstream: none of parent #35's walker work is required here. This
  primitive operates on `Run2MaxRecord[]`, not on Plan trees.
- External: `valibot` untouched. `normalize-fit-file` untouched —
  `Run2MaxRecord` is the consumed shape.
- Tooling: `pnpm test` / `vitest` for repository-runnable verification.
  (`pnpm typecheck` is not a defined workspace command — see parent
  #32's closure flag.)

## Flags

- Once this parent closes, the aggregator's input/output shapes are
  stable for the rest of the cycle. Later parents (engine/presentation
  split, helper consolidation, public-export rewrite) consume the
  shapes settled here. Re-introducing a bespoke field-averaging block
  in a downstream parent is a drift signal — flag it.
- The aggregator parent does not own `getDistance(record)` consolidation.
  That helper currently appears in `computations/segments.ts:15`,
  `computations/km-splits.ts:16`, and `computations/elevation.ts:14`.
  Resolve in the helper-consolidation parent of this cycle. The
  aggregator parent may co-locate one local copy if the seam genuinely
  needs it; do not eagerly consolidate across modules from here.
- The aggregator's design-it-twice answers the cycle PRD's `MUST RESOLVE`
  on parameter shape (bucketBy vs pre-bucketed). After this parent
  closes, update `context/cycles/01-deepen-engine/prd.md` to mark the
  question resolved with the chosen shape.
- If the aggregator decision merits an ADR (per cycle-PRD policy:
  decisions hard to reverse, surprising without context, and the
  result of a real trade-off), `sdp-adr` runs at parent close. The
  bucketing-shape decision is a likely ADR candidate.
- If the migration uncovers a shape mismatch between `SegmentRow` and
  `KmSplitRow` that the aggregator cannot bridge without renaming a
  field, that is scope creep into type unification. Flag it as a
  follow-up rather than expanding this parent.
- The dynamics-first sub-issue ordering treats the single-bucket case
  as a tracer bullet. If sub-issue #39 holds the full migration and
  the tracer is implicit, that is fine; if a second sub-issue is
  needed, it is sequenced as #40 after #39's tracer-only scope closes.
