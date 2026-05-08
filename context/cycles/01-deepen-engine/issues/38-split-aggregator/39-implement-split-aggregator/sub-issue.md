# Sub-Issue #39 — Implement and adopt the split-aggregation primitive

Vertical slice for parent issue #38. Delivers the full parent scope as a
single behaviour-preserving change: design the aggregator, implement it,
migrate `dynamics.ts` (single-bucket tracer), then `segments.ts`
(unweighted multi-bucket) and `km-splits.ts` (weighted multi-bucket),
and export the aggregator under the engine's Analysis output grouping.

## Description

Introduce a single split-aggregation primitive in `@run2max/engine`. The
primitive consumes one bucket of records (each with an optional fractional
weight) plus an aggregation config, and returns the shared aggregated
field set: power, heart rate, cadence, Tier-2 dynamics, Tier-3 dynamics,
and the two derived metrics (`verticalRatio`, `formPowerRatio`).
Capability gating (Tier-2 / Tier-3) lives inside the aggregator.

Each existing call site keeps its own bucketing logic (the part that is
genuinely different) and its own row-shape post-processing (per-bucket
fields like `lapIndex` / `km` / `distance` / `duration` / `avgPace` /
elevation / weather null-placeholders). Aggregation itself is shared.

The scope is a vertical slice — every concrete acceptance criterion of
parent #38 is closed by this sub-issue. If implementation reveals the
slice is too large (e.g. the weighted-vs-unweighted unification uncovers
a shape mismatch the aggregator cannot bridge cleanly), it splits and a
sibling sub-issue is added under parent #38. Today, only this sub-issue
is planned.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| TypeScript compiler | In-process | Test directly: type-check is part of `pnpm test`. |
| `vitest` | In-process | Existing engine and CLI test suites run as-is. |
| `Run2MaxRecord` (from `normalize-fit-file`, re-exported via `engine/types.ts`) | In-process | Test directly: aggregator input is `Run2MaxRecord` shape, already exercised by existing fixtures. |
| `DataCapabilities` and `ZoneConfig` (engine/types.ts) | In-process | Test directly: capability gates are passed through aggregator config. |
| Existing `computations/segments.ts`, `computations/km-splits.ts`, `computations/dynamics.ts` test suites | In-process | Test directly: existing per-module tests are the migration's regression net. |
| Existing `computations/quantify.test.ts` | In-process | Test directly: end-to-end aggregation across a real Run is exercised here. |

No remote, collaborator-owned, or external dependencies. No port required —
no second adapter is in play. The aggregator is pure data transformation
over already-bucketed records.

## Interface design

The interface this sub-issue must commit to is the aggregator's *input
shape*, *config shape*, and *output shape*. The runtime contract of every
migrated call site does not change: `SegmentRow`, `KmSplitRow`, and
`DynamicsSummary` shapes in `engine/types.ts` are unchanged.

### Design-it-twice

**Alternative A — Pre-bucketed input: `aggregateBucket(bucket, config): AggregatedFields`**

The aggregator takes one already-formed bucket (a list of records, each
with an optional weight) plus a config flag set, and returns the shared
aggregated field set. Callers do their own bucketing and call the
aggregator once per bucket.

```ts
export interface WeightedRecord {
  record: Run2MaxRecord;
  weight?: number; // 0..1, defaults to 1 (unweighted)
}

export interface AggregationConfig {
  capabilities: DataCapabilities;
  zones?: ZoneConfig[]; // when present, classifies avgPower into a zone
}

export interface AggregatedFields {
  // Always present (Tier 1)
  avgPower: number | null;
  zone: string | null;          // null when no zones config or no power
  avgHeartRate: number | null;
  avgCadence: number | null;
  // Tier 2 (null when !capabilities.hasRunningDynamics)
  avgStanceTime: number | null;
  avgStanceTimeBalance: number | null;
  avgStepLength: number | null;
  avgVerticalOscillation: number | null;
  // Tier 3 (null when !capabilities.hasStrydEnhanced)
  avgFormPower: number | null;
  avgAirPower: number | null;
  // Derived
  verticalRatio: number | null; // (vo / sl) * 100, requires Tier 2
  formPowerRatio: number | null; // formPower / power, requires Tier 3
}

export function aggregateBucket(
  bucket: readonly WeightedRecord[],
  config: AggregationConfig,
): AggregatedFields;
```

For dynamics' extra Tier-3 fields (`legSpringStiffness`,
`legSpringStiffnessBalance`, `verticalOscillationBalance`), the dynamics
call site computes those at the call site after `aggregateBucket`
returns. They are dynamics-only (`SegmentRow` and `KmSplitRow` do not
carry them) so widening `AggregatedFields` to hold them would force
segments and km-splits to ignore three always-null fields. Better to
keep them where they are used.

- Leverage: high — one symbol covers every bucket-aggregation site. The
  three call sites stay clean: each owns its own bucketing and its own
  row-shape post-processing.
- Locality: high — aggregator module is the single home of capability
  gating and field averaging. No second module to keep in sync.
- Testability: simple — a small focused unit test on a fixture record
  set with mixed weights validates the shape; every migrated call
  site's existing test is the end-to-end behaviour-preservation net.

**Alternative B — `bucketBy` strategy: `aggregateAll(records, config): AggregatedFields[]`**

The aggregator takes the full `Run2MaxRecord[]` plus a `bucketBy`
function returning bucket keys (or boundaries), performs the bucketing,
and returns one `AggregatedFields` per bucket.

```ts
export interface BucketStrategy {
  // Returns the bucket index (0-based) for a given record.
  // Returns -1 to skip the record.
  bucketOf(record: Run2MaxRecord, prev: Run2MaxRecord | null, index: number): number;
  // Optional: return a partial weight for split-edge interpolation.
  weightOf?(record: Run2MaxRecord, prev: Run2MaxRecord | null, bucketIndex: number): number;
}

export function aggregateAll(
  records: readonly Run2MaxRecord[],
  strategy: BucketStrategy,
  config: AggregationConfig,
): AggregatedFields[];
```

- Leverage: medium — the aggregator owns more, but the three call
  sites' bucketing strategies are not isomorphic. Lap time-windowing
  classifies records by the *next* lap-start timestamp; km
  distance-windowing splits records *across* boundaries with two-sided
  fractional weights; dynamics is a single bucket. Stuffing all three
  into one strategy interface either widens it to absorb every edge
  case (and now bucket discovery lives in two places, badly) or forces
  the km-splits edge-interpolation logic to live awkwardly inside a
  `weightOf` callback.
- Locality: medium — bucketing logic and aggregation logic merge into
  one module, but only one of the three call sites (dynamics) is
  served simply. The other two pay an indirection cost.
- Testability: harder — testing the aggregator now requires fixture
  records *plus* a strategy mock; the strategy interface is a
  test-surface widening that A avoids.

**Alternative C — Two-step pipeline: `bucketize` + `aggregate` separately exported**

Two functions: `bucketize(records, strategy): WeightedRecord[][]` and
`aggregate(buckets, config): AggregatedFields[]`. Callers compose.

- Leverage: low — `bucketize` for segments and km-splits would still
  hold both lap-time-windowing and km-distance-windowing logic
  side-by-side, requiring a discriminator. Dynamics doesn't need
  `bucketize` at all (it just wraps `records` in a `WeightedRecord[]`
  with weight=1 and passes one bucket). The two-step shape is correct
  in principle but the bucketing step is not actually shared between
  segments and km-splits — they share *zero* bucketing logic, only
  aggregation.
- Locality: low — splits the "obviously one thing" (aggregation) into
  two functions where one would do.
- Testability: identical to A on the aggregation side, plus a
  `bucketize` surface that adds nothing.

### Choice

**A (pre-bucketed input).** The three call sites do not share bucketing
logic — they share aggregation logic. Folding aggregation out (A)
matches the actual deepening: one symbol, one home for capability
gating and Tier-2/Tier-3 averaging, three call sites that keep their
genuinely-different bucketing where it lives. B forces bucketing
discovery into the aggregator and pays for it at every site that has
non-trivial bucketing. C splits one thing into two without shared
bucketing logic to justify the split.

B is rejected in one sentence: bucketing strategies for lap-time,
km-distance, and single-bucket are not isomorphic and a `BucketStrategy`
interface wide enough to hold all three is wider than the three
inline implementations it replaces.

C is rejected in one sentence: segments and km-splits share aggregation
but not bucketing, so a separately-exported `bucketize` step has no
shared callers — it adds a public surface with one consumer each.

This decision answers the cycle PRD's `MUST RESOLVE` open question on
the unified split-aggregator parameter shape; once parent #38 closes,
update `context/cycles/01-deepen-engine/prd.md` to mark it resolved.

The choice is a candidate ADR per the cycle PRD; rationale captured here
is the seed for that ADR if one is written at parent close.

### Aggregator location

`packages/engine/src/computations/aggregate.ts` — a new module.
`AggregatedFields`, `WeightedRecord`, `AggregationConfig`, and
`aggregateBucket` live there. The aggregator does not belong in
`computations/utils.ts` because it is a domain-aware operation
(capability gating, Tier-2/Tier-3 field set, derived metrics), not a
generic numerical helper like `avg` or `rollingWindowPeak`.

Rejected: putting `aggregateBucket` in `computations/utils.ts`. One
sentence: `utils.ts` holds capability-agnostic numerical primitives;
the aggregator is capability-aware and would force `utils.ts` to import
domain types.

### Public interface

```ts
// packages/engine/src/computations/aggregate.ts
import type {
  Run2MaxRecord,
  DataCapabilities,
  ZoneConfig,
} from "../types.js";

export interface WeightedRecord {
  record: Run2MaxRecord;
  weight?: number; // defaults to 1
}

export interface AggregationConfig {
  capabilities: DataCapabilities;
  zones?: ZoneConfig[];
}

export interface AggregatedFields {
  avgPower: number | null;
  zone: string | null;
  avgHeartRate: number | null;
  avgCadence: number | null;
  avgStanceTime: number | null;
  avgStanceTimeBalance: number | null;
  avgStepLength: number | null;
  avgVerticalOscillation: number | null;
  avgFormPower: number | null;
  avgAirPower: number | null;
  verticalRatio: number | null;
  formPowerRatio: number | null;
}

export function aggregateBucket(
  bucket: readonly WeightedRecord[],
  config: AggregationConfig,
): AggregatedFields;
```

Invariants:
- `aggregateBucket(bucket, config)` returns the shared field set. Every
  field's value is `null` if no record in the bucket has a non-null
  value for the underlying metric *or* the relevant capability flag
  (`hasRunningDynamics` for Tier 2, `hasStrydEnhanced` for Tier 3) is
  false.
- A `WeightedRecord` with `weight === undefined` is treated as
  `weight = 1`. All-unweighted input produces the same output as a
  plain arithmetic mean across the bucket.
- A bucket of mixed weights produces a weighted mean: `sum(value *
  weight) / sum(weight)` for each field, computed per-field so a record
  contributing `null` for one field does not poison its weight
  contribution to other fields.
- `zone` is `null` unless `config.zones` is provided *and* `avgPower` is
  non-null. Zone classification uses `classifyPowerZone` (already in
  `computations/zones.ts`), unchanged.
- `verticalRatio` is `(avgVerticalOscillation / avgStepLength) * 100`
  when both are non-null and `avgStepLength > 0`; otherwise `null`.
- `formPowerRatio` is `avgFormPower / avgPower` when both are non-null
  and `avgPower > 0`; otherwise `null`. (Note: today's `dynamics.ts`
  computes `avgFormPowerRatio` as the *mean of per-record ratios*, not
  as the ratio of means. See "behaviour preservation" below — the
  aggregator must preserve the *segment/km-split* semantic, and
  dynamics must continue to compute its `avgFormPowerRatio` and
  `avgVerticalRatio` *itself* if it needs the per-record-mean form.)

Error modes:
- `aggregateBucket` does not throw. An empty bucket returns all-null
  fields. A bucket of records with all-null values for a metric
  returns null for that metric.

### Behaviour preservation

Today's three sites differ subtly on the derived metrics
(`verticalRatio`, `formPowerRatio`):

- `segments.ts` and `km-splits.ts` compute `verticalRatio` and
  `formPowerRatio` as the **ratio of (weighted) means**:
  `(avgVerticalOscillation / avgStepLength) * 100` and
  `avgFormPower / avgPower`.
- `dynamics.ts` computes `avgVerticalRatio` and `avgFormPowerRatio` as
  the **mean of per-record ratios**:
  `mean(verticalOscillation_i / stepLength_i)` (and similarly for
  formPower). The output field names also differ
  (`avgVerticalRatio`, `avgFormPowerRatio` vs `verticalRatio`,
  `formPowerRatio`).

These are different semantics. Byte-identity preservation requires
keeping both. The aggregator returns the **ratio-of-means** form
(matching segments and km-splits, the two callers that put it in their
public output as `verticalRatio` / `formPowerRatio`). The dynamics call
site continues to compute `avgVerticalRatio` and `avgFormPowerRatio` at
the call site for its `DynamicsSummary` output, using a small private
helper. The aggregator's `verticalRatio` and `formPowerRatio` fields
are simply unused by the dynamics consumer.

This is a deliberate choice: unifying the two semantics behind one name
would violate "no behaviour change" (cycle PRD, success metrics). The
divergence is recorded here so a future cycle can decide which
semantic is canonical and reduce again.

## Acceptance criteria

- `packages/engine/src/computations/aggregate.ts` exists and exports
  `WeightedRecord`, `AggregationConfig`, `AggregatedFields`, and
  `aggregateBucket` as specified above.
- `packages/engine/src/index.ts` re-exports the aggregator's public
  symbols under the Analysis output grouping.
- `packages/engine/src/computations/segments.ts` consumes
  `aggregateBucket` to produce `SegmentRow` fields. The lap-time
  bucketing logic stays. The `buildSegmentRow` body's Tier-2 / Tier-3
  / derived-metrics block is replaced by one `aggregateBucket` call;
  per-bucket fields (`lapIndex`, `distance`, `duration`, `avgPace`,
  elevation, weather null-placeholders) stay at the call site.
- `packages/engine/src/computations/km-splits.ts` consumes
  `aggregateBucket`. The `weightedAvg` helper is deleted. The
  km-distance bucketing logic and `WeightedRecord[][]` construction
  stays at the call site (now using the aggregator's exported
  `WeightedRecord` type rather than the private one).
- `packages/engine/src/computations/dynamics.ts` consumes
  `aggregateBucket` for the shared field set, mapping the bucket-level
  output into `DynamicsSummary` (renaming `avgPower` → not used,
  `avgStanceTime` → `avgStanceTime`, etc.). The Tier-3 extras
  (`avgLegSpringStiffness`, `avgLegSpringStiffnessBalance`,
  `avgVerticalOscillationBalance`) stay at the call site.
  `avgFormPowerRatio` and `avgVerticalRatio` (per-record-mean form)
  stay at the call site as documented.
- The duplicated `getDistance(record)` helper (`segments.ts:15`,
  `km-splits.ts:16`) is *not* consolidated by this sub-issue — it
  remains where it is. Flagged for the helper-consolidation parent.
- `pnpm test` succeeds at the workspace root with no test
  modifications beyond mechanical replacements where they apply (most
  tests should require zero changes since output shapes are
  unchanged).
- Output of `quantify` for the existing engine fixtures is
  byte-identical to pre-aggregator output. Verified by running
  `quantify` against a fixture and diffing JSON output.
- Grep for `weightedAvg` outside `aggregate.ts` returns nothing in
  `packages/engine/src/`. Grep for the Tier-2 averaging pattern
  (`stanceTime ?? null`, `stepLength ?? null`, `verticalOscillation ?? null`
  appearing in proximity) returns no matches outside `aggregate.ts` in
  the engine source.
- TypeScript strict mode stays on. `TS2589` is not emitted at any point
  during the change.

## Proposed tests

1. **Aggregator unit test (new)** —
   `packages/engine/src/computations/aggregate.test.ts`. Construct
   small fixture buckets and assert:
   - All-Tier-1 records, no zones config: `avgPower`, `avgHeartRate`,
     `avgCadence` are arithmetic means; `zone` is `null`; Tier-2 and
     Tier-3 fields are `null` (capability gate off).
   - All-Tier-1 records, with `capabilities.hasRunningDynamics = true`
     but no Tier-2 fields on records: Tier-2 fields are `null`.
   - Mixed Tier-2 / Tier-3 records with capabilities on: averages match
     hand-computed values; `verticalRatio` and `formPowerRatio` match
     ratio-of-means semantics.
   - Weighted bucket (weights 0.5 / 0.5 / 1): output equals weighted
     mean, not arithmetic mean. Per-field weight contribution is not
     poisoned by `null`s in other fields.
   - Empty bucket: all fields `null`.
   - Bucket with `weight = undefined` for every record: output equals
     unweighted mean.
2. **Existing per-module tests pass unchanged.**
   `computations/segments.test.ts`, `computations/km-splits.test.ts`,
   and `computations/dynamics.test.ts` continue to pass without
   behavioural modification. Where they currently spot-check Tier-2 /
   Tier-3 / derived fields on the row output, those assertions now
   exercise the aggregator transitively.
3. **Existing `quantify.test.ts` passes unchanged.** Whole-Run
   aggregation across a real fixture is the integration regression net.
4. **Fixture byte-identity check.** Run `quantify` against the engine's
   existing fixture(s) pre-change and post-change; JSON output diff
   must be empty. (Manual verification step rather than a new automated
   test — the cycle PRD's non-goals exclude introducing an end-to-end
   byte-diff harness.)
5. **No new behavioural test is added.** This sub-issue is a refactor;
   new behaviour would be scope drift. If existing test coverage gaps
   are discovered (e.g. dynamics' per-record-mean ratio semantic is
   not explicitly asserted today), record the gap as a flag on parent
   #38 rather than expanding this sub-issue.

## Affected artifacts

- `packages/engine/src/computations/aggregate.ts` — **new file**, holds
  `WeightedRecord`, `AggregationConfig`, `AggregatedFields`, and
  `aggregateBucket`.
- `packages/engine/src/computations/aggregate.test.ts` — **new file**,
  aggregator unit tests.
- `packages/engine/src/computations/segments.ts` — replace
  `buildSegmentRow`'s Tier-2 / Tier-3 / derived block (lines ~85–122)
  with one `aggregateBucket` call. Wrap each lap's `Run2MaxRecord[]`
  bucket in `WeightedRecord[]` with `weight = 1` (or omit `weight`,
  letting the default apply). Keep `lapIndex`, `distance`, `duration`,
  `avgPace`, elevation, and weather null-placeholders at the call
  site. The local `getDistance` and `toMs` helpers stay.
- `packages/engine/src/computations/km-splits.ts` — delete the private
  `weightedAvg` (lines 92–108) and the local `WeightedRecord` interface
  (lines 24–27). Import `WeightedRecord` and `aggregateBucket` from
  `aggregate.ts`. Replace `buildKmSplitRow`'s Tier-2 / Tier-3 / derived
  block (lines ~127–164) with one `aggregateBucket` call. Keep `km`,
  `distance`, `duration`, `avgPace`, elevation, and weather
  null-placeholders at the call site. The bucketing logic
  (lines 38–85) stays. The local `getDistance` stays.
- `packages/engine/src/computations/dynamics.ts` — replace the Tier-2
  averaging block (lines 17–31), the Tier-3 averaging block
  (lines 33–45), and the derived-metric blocks for `avgFormPowerRatio`
  and `avgVerticalRatio` *only insofar as they overlap the aggregator's
  output*. Keep `avgVerticalOscillationBalance`,
  `avgLegSpringStiffness`, `avgLegSpringStiffnessBalance` at the call
  site (Tier-3 dynamics-only fields the aggregator does not produce).
  Keep `avgFormPowerRatio` and `avgVerticalRatio` at the call site
  with their per-record-mean semantic intact (do not switch to the
  aggregator's ratio-of-means form — that would change behaviour).
  Wrap `records` in a single `WeightedRecord[]` bucket with weight = 1
  per record; call `aggregateBucket` once.
- `packages/engine/src/index.ts` — re-export `WeightedRecord`,
  `AggregationConfig`, `AggregatedFields`, and `aggregateBucket` from
  `computations/aggregate.js` under the existing Analysis output
  grouping (alongside `SegmentRow`, `KmSplitRow`, `DynamicsSummary`).

## Dependencies

- Upstream sub-issues: parent #32 / sub-issue #33 (closed) — the
  engine's domain-type discipline is the baseline. Parent #35 / sub-issue
  #36 (closed) — not on this path; aggregator does not touch Plan trees.
- External services: none.
- Test fixtures: existing engine fixtures are reused unchanged. The
  aggregator unit test introduces small in-test record fixtures rather
  than new `.fit` files.
