# Parent Issue #38 — Split-aggregation primitive

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Collapse the three near-identical row-building paths in `@run2max/engine`
into a single split-aggregation primitive parameterised by bucketing
strategy. Today the same Tier-aware aggregation logic is restated three
times across:

- `packages/engine/src/computations/segments.ts` — lap-bucketed records,
  unweighted `avg`, produces `SegmentRow`.
- `packages/engine/src/computations/km-splits.ts` — distance-bucketed records
  with fractional weights, custom `weightedAvg`, produces `KmSplitRow`.
- `packages/engine/src/computations/dynamics.ts` — single-bucket (whole-Run)
  records, unweighted `avg`, produces `DynamicsSummary`.

All three repeat the same capability gating (Tier 2 / Tier 3), the same
field list (`stanceTime`, `stanceTimeBalance`, `stepLength`,
`verticalOscillation`, `formPower`, `airPower`), and the same derived
metrics (`verticalRatio`, `formPowerRatio`). The bucketing strategy is the
only meaningful axis of variation; the aggregation itself does not differ.

After this parent closes, those three files share one aggregation core.
Bucketing remains the per-site concern (lap time-windows for segments,
km distance-windows with fractional weights for km-splits, single bucket
for dynamics). The aggregator does not own bucket discovery — it consumes
already-bucketed input.

## Owned user stories

From the cycle PRD:

- As a maintainer changing how a tier-aware metric is rolled up across a
  Run, I edit the single split-aggregation primitive once and segments,
  km-splits, and dynamics all benefit, so I do not edit three near-identical
  row builders.

A success-signal story from the cycle PRD also lands here:

- Adding a new split-aggregated metric (hypothetically) takes editing one
  file, and the same change shows up in segments, km-splits, and dynamics
  consistently without further work.

## Encounter statements affecting this scope

- A maintainer opening any of `computations/segments.ts`,
  `computations/km-splits.ts`, or `computations/dynamics.ts` first
  encounters bucket construction (the part that is genuinely different)
  and a single shared call into the aggregator — not a fourth restatement
  of the Tier-2/Tier-3 averaging block.
- A maintainer opening the engine's public exports first encounters the
  aggregation primitive grouped under `Analysis output` (alongside
  `Segment`, `Km Split`, `Quantify`), reflecting `ubiquitous-language.md`.
- A maintainer adding a new aggregated field (e.g. a hypothetical Tier 3
  metric) edits the aggregator and its capability gate once; segments,
  km-splits, and dynamics pick up the new field through the shared shape.

## Directional dependencies on other sub-PRDs

- Upstream: parent #32 (closed) — named domain types are already in
  `plan/types.ts`. No re-opening. Parent #35 (closed) — Plan walker is
  not on this path; this primitive operates on `Run2MaxRecord[]`, not on
  Plan trees.
- Downstream: the engine/presentation-split parent issue consumes this
  primitive's output shape unchanged — formatters render `SegmentRow[]`,
  `KmSplitRow[]`, and `DynamicsSummary` exactly as today, but those
  shapes will be produced by one path. The helper-consolidation parent
  may further fold `getDistance(record)` into a single home; the
  aggregator parent does not own that consolidation but flags any
  duplication it can no longer justify.
- Sideways: no behaviour change. `quantify` output for fixtures stays
  byte-identical. The cycle PRD's success metric ("the three current
  row-builder paths reach one shared primitive with bucketing as the
  only varying dimension") is the verification target.

## Domain language

The aggregator's input ("a bucket of records, optionally weighted") and
its output ("the aggregated row for that bucket") map to **Segment**
and **Km Split** as already defined in `ubiquitous-language.md`.
**DynamicsSummary** is the whole-Run aggregation of the same shape — it
is a single-bucket case of the same primitive.

No new public-facing domain term is introduced. Internal type names like
`AggregationInput` or `WeightedSlice` may emerge during implementation;
those stay internal to the aggregator module unless they leak into a
glossary-relevant seam, in which case `sdp-domain-validate` runs before
the sub-issue closes.

The cycle PRD's `MUST RESOLVE` open question — "what is the shape of the
unified split-aggregator parameter — a `bucketBy` strategy function
returning bucket keys, or a pre-bucketed `Slice[]` input the aggregator
just reduces over?" — is decided in this sub-PRD's accompanying
sub-issue via design-it-twice. Pre-resolution preference (recorded so
the design-it-twice can challenge it): **pre-bucketed input**, because
the three call sites' bucketing logic is the part that is genuinely
different and is already deep where it lives. Folding bucket discovery
into the aggregator widens its surface to absorb three unrelated
strategies; folding aggregation out keeps each call site shallow only
where it is naturally shallow.
