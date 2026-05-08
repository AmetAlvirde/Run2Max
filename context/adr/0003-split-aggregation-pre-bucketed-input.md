# Split aggregation uses pre-bucketed input

_Made during: 01-deepen-engine / Parent Issue #38 / Sub-Issue #39_
_Scope: product_
_Status: accepted_

The shared split-aggregation primitive is exposed as
`aggregateBucket(bucket, config): AggregatedFields`, where callers provide one
already-bucketed list of weighted records. This keeps bucketing ownership in
`segments.ts`, `km-splits.ts`, and `dynamics.ts` while consolidating
capability-aware aggregation and derived ratio-of-means fields into one module.

## Considered Options

- Pre-bucketed input (`aggregateBucket(bucket, config)`) — accepted.
- Strategy-driven bucketing (`aggregateAll(records, strategy, config)`) — rejected because lap-time, km-distance interpolation, and single-bucket classification are not isomorphic under one narrow strategy seam.
- Two-step public pipeline (`bucketize` + `aggregate`) — rejected because these callers share aggregation but not bucket discovery, so a shared `bucketize` surface adds API without shared leverage.

## Consequences

- Shared Tier-2/Tier-3 gating and weighted/unweighted averaging now live in `computations/aggregate.ts`.
- Per-call-site bucket discovery remains local and explicit.
- Dynamics keeps its per-record-mean derived semantics (`avgVerticalRatio`, `avgFormPowerRatio`) at the call site to preserve behavior.
