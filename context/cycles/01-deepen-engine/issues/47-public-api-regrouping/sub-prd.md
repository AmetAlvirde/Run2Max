# Parent Issue #47 — Public API regrouping

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Rewrite `packages/engine/src/index.ts` so that the engine's public surface is
shorter, every remaining export maps to a glossary term in
`ubiquitous-language.md` or to an obvious infrastructure concern, and the
top-level groupings match the four ubiquitous-language sections
(Periodization, Runs and capture, Metrics and zones, Analysis output) plus
infrastructure as needed.

Today, `engine/index.ts` is 109 lines and exports roughly 80 names under six
section banners that mix domain grouping with implementation grouping
(`Public types`, `Public functions`, `quantify`, `Computation utilities`,
`Formatters`, `Plan schema`, `Plan templates`). The banners reflect file
location and history rather than the domain language a maintainer reaches
for when finding a seam.

This parent is the cycle's last parent. The four upstream parents (#32
named Plan types, #35 plan walker, #38 split aggregator, #41
engine/presentation separation, #44 utility consolidation) have all
landed. The internal seams are stable. The remaining work is a re-grouping
of the public face — and a count reduction by either folding shallow
exports into deeper APIs or marking genuinely internal helpers as such and
removing them from the public surface.

After this parent closes:

- `engine/index.ts` exports ≤30 names. Every remaining export maps either
  to a term in `ubiquitous-language.md` or to a clearly named
  infrastructure concern (config loading, formatter output, case-key
  helpers).
- The top-level groupings in `index.ts` match the four ubiquitous-language
  sections, in the order they appear in the glossary, plus an
  Infrastructure grouping at the end.
- Any export removed from the public surface is either folded into a
  deeper API (with the justification recorded) or genuinely internal (and
  no current consumer needs it). No silent deletion of exports the CLI or
  external embedders depend on.
- The CLI continues to function. If an export is renamed or removed,
  `packages/cli/src/**` is updated in the same PR. CLI behaviour is
  byte-identical for `quantify` and `plan` commands against existing
  fixtures.

User-facing behaviour stays byte-identical. This is a public-API
re-shaping, not a behaviour change.

## Owned user stories

From the cycle PRD:

- As a maintainer reading the engine's public exports, I see fewer names
  grouped by domain concept, so I can find the seam I need without
  scanning fifty exports.
- As a maintainer adding a feature that walks the Plan / aggregates
  splits / formats output, I look at one section banner of `index.ts`
  whose name matches the glossary, and the symbol I need is in that
  section. I do not have to scan the full file or guess which banner
  ("Public functions" vs "Computation utilities" vs "Plan schema") owns
  the symbol.

A success-signal story from the cycle PRD also lands here:

- A grilling session on a new sub-PRD references named modules that
  match glossary terms one-to-one without qualifier translation.
  After this parent closes, that property holds for the public surface
  (the modules already match the glossary internally; this parent
  closes the gap on what the index.ts re-exports).

## Encounter statements affecting this scope

- A maintainer opening `packages/engine/src/index.ts` first encounters a
  shorter, domain-grouped export list whose top-level groupings match
  `ubiquitous-language.md`: Periodization, Runs and capture, Metrics
  and zones, Analysis output, plus an Infrastructure grouping for
  config and formatter helpers.
- A maintainer searching the engine's public surface for a Plan-related
  symbol (`Plan`, `walkPlan`, `getPlanStatus`, `reconcile`, `adjustPlan`,
  `syncWeek`, `associateRun`) finds them all under one Periodization
  heading, not split between "Public types", "Plan schema", and "Plan
  templates".
- A maintainer searching for a Run-analysis symbol (`quantify`,
  `AnalysisResult`, `Run2MaxRecord`, `computeSegments`,
  `computeKmSplits`) finds them under Analysis output / Runs and
  capture, not split between "Public types", "Public functions", and
  "Computation utilities".
- A maintainer looking at the public surface to estimate API breadth
  sees ≤30 names total, not 80. Names removed from the surface are
  either folded into a deeper API (recorded) or genuinely internal
  (recorded).

## Directional dependencies on other sub-PRDs

- Upstream: parent #32 (closed) — named `Plan` / `Mesocycle` / `Fractal`
  / `Week` / `TestingPeriod` interfaces are stable. They appear under
  Periodization in the new grouping.
- Upstream: parent #35 (closed) — `walkPlan` and `WeekContext` are
  stable. They appear under Periodization.
- Upstream: parent #38 (closed) — `aggregateBucket` and its types are
  stable. They appear under Analysis output (or a sub-grouping of it).
- Upstream: parent #41 (closed) — `formatDefaultView` and
  `formatFullView` were re-located to `formatters/plan.js`. They
  appear under either Periodization (Plan presentation) or
  Infrastructure (output formatting). The grouping decision is part
  of this parent's design-it-twice.
- Upstream: parent #44 (closed) — `addDays`,
  `transformKeysSnakeToCamel`, `transformKeysCamelToSnake` are on the
  public surface as cross-package consumers (CLI). They appear under
  Infrastructure unless the design-it-twice argues for inlining them
  back into the CLI.
- Sideways: no behaviour change. CLI fixtures stay byte-identical.
- Downstream: none. This is the last parent in the cycle. Cycle close
  follows once this parent's AAR lands.

## Domain language

`ubiquitous-language.md` provides the four top-level groupings this
parent must align with:

- **Periodization** — Block, Bridge Block, Plan, Mesocycle, Fractal,
  Week, Week Type, Testing Period, Reason.
- **Runs and capture** — Run, FIT File, Tier 1/2/3, Running Dynamics,
  Stryd-enhanced.
- **Metrics and zones** — CP, eFTP, LTHR, Zone, NP, IF, RSS.
- **Analysis output** — Quantify, AnalysisResult, Segment, Km Split,
  Anomaly, Capabilities, Plan Context, Week Progress.

The glossary does not include `formatDefaultView`, `formatFullView`,
`formatResult`, `loadConfig`, `transformKeysSnakeToCamel`,
`transformKeysCamelToSnake`, `addDays`, `parsePlan`, `validatePlan`,
`loadPlan`, `buildPlanFromTemplate`, `reconcile`, `getPlanStatus`,
`syncWeek`, `adjustPlan`, `walkPlan`, `associateRun`,
`detectWeekDeviations`, `reportHasAnomalies`, `detectCapabilities`,
`detectAnomalies`, `applyAnomalyExclusions`, `aggregateBucket`,
`computeSegments`, `computeKmSplits`, `computeDynamicsSummary`,
`computeSummary`, `computeElevationProfile`, `computeNormalizedPower`,
`computeZoneDistribution`, `classifyZone`, `classifyPowerZone`. These
are operations and utilities — not nouns — and live under whichever
domain grouping their primary noun belongs to. A maintainer asking
"what does this function operate on?" gets a Plan, a Run, or a Zone,
each of which is a glossary term.

`sdp-domain-validate` is not required for this parent unless the
design-it-twice surfaces a candidate domain noun (e.g. "Public API"
becomes a coined term). Pre-resolution preference: do not invent
domain nouns for grouping the public surface; the existing four
sections plus Infrastructure are sufficient.

The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` open question on
the final shape of the engine's public export grouping is answered
here. After parent close, update
`context/cycles/01-deepen-engine/prd.md` to mark it resolved with
the chosen grouping shape.
