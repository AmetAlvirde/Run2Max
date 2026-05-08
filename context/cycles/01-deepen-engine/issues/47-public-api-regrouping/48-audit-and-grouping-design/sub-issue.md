# Sub-Issue #48 — Audit and grouping design

## Description

Produce the decision document that drives the rest of parent #47. Read
every public export in current `packages/engine/src/index.ts`, classify
each as KEEP / FOLD / HIDE, design-it-twice the grouping shape, and
record the result as a manifest committed to this issue folder.

This sub-issue does **not modify any source code**. The deliverable is
a markdown manifest with a row per current export and a chosen
grouping shape. Subsequent sub-issues (created lazily) apply the
manifest.

The split is intentional. The audit is decision-heavy and benefits
from review in isolation. The apply is mechanical given the manifest.
Mixing them in one sub-issue would drown the review of decisions in
the noise of move/rename diffs.

## Dependency classification

**In-process** for the audit itself: every input is a file in the
local source tree, every output is a markdown document in this issue
folder. No external services, no network, no filesystem state beyond
reading source files and writing the manifest.

The audit references the CLI's import surface
(`packages/cli/src/**`) to confirm the HIDE classifications. That
reference is local to the workspace and uses grep — no port/adapter
needed.

## Interface design

### Inputs

- Current `packages/engine/src/index.ts` (the export list to audit).
- `context/ubiquitous-language.md` (the glossary against which exports
  are checked).
- `packages/cli/src/**` (the consumer tree against which HIDE
  classifications are confirmed).
- `packages/engine/src/**` (the implementation tree to find each
  export's source module and judge whether folding is reasonable).

### Output

A single markdown file at
`context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md`
with:

- **Section 1 — Chosen grouping shape.** The five top-level banners
  (Periodization, Runs and capture, Metrics and zones, Analysis
  output, Infrastructure) in glossary order, each with a one-sentence
  charter explaining what belongs there.
- **Section 2 — Export audit table.** One row per current public
  export. Columns: `name`, `current source module`, `kind`
  (function / class / const / type), `classification`
  (KEEP / FOLD / HIDE), `target banner` (if KEEP), `fold target`
  (if FOLD — the deeper API name and rationale), `hide rationale`
  (if HIDE — confirmation that no CLI or external consumer imports
  it, verified by grep).
- **Section 3 — Count summary.** Total KEEP count (must reach ≤30
  per the parent's acceptance criterion), per-banner counts, FOLD
  count (with a one-line summary of the deeper APIs that emerge),
  HIDE count.
- **Section 4 — Cross-package consumer index.** The set of engine
  exports the CLI imports today, derived by grep against
  `packages/cli/src/**`. Used to validate that no HIDE classification
  silently breaks the CLI.
- **Section 5 — Open questions for follow-on sub-issues.** Any
  decisions the audit surfaced that need their own sub-issue
  (e.g. an API fold that needs design work). These become candidate
  sub-issues #49+.

### Design-it-twice on grouping shape

- **Alternative A — Domain-led, glossary-aligned.** Five banners in
  the order of `ubiquitous-language.md`: Periodization, Runs and
  capture, Metrics and zones, Analysis output, Infrastructure. Each
  export sits under the banner whose primary noun the export
  operates on (e.g. `walkPlan`, `getPlanStatus`, `reconcile`,
  `adjustPlan` are Periodization because they operate on Plan).
  Operations and utilities live under their primary-noun home, not
  in a separate "operations" banner.
- **Alternative B — Layer-led, consumer-ergonomic.** Banners ordered
  by typical consumer flow: Configuration, Plan management, Run
  ingestion, Analysis, Output. Reads top-to-bottom like a
  data-flow diagram. May feel more discoverable for new
  contributors who are reading `index.ts` to understand the
  pipeline.
- **Alternative C — Hybrid: domain-led top with operation
  sub-bands.** Five domain banners as in A, but with sub-comments
  inside each banner separating "Types" from "Functions". Splits
  the difference between A and B at the cost of more visual
  noise.

**Pre-resolution preference: A.** The cycle PRD's encounter
statement is explicit: top-level groupings match
`ubiquitous-language.md`. That is a hard constraint, not a
preference. The design-it-twice in this sub-issue can challenge the
preference but must show the encounter statement is satisfiable
under the chosen alternative — B fails the constraint outright by
introducing layer-named banners. C technically satisfies it but
adds visual noise that A does not.

The audit records the chosen shape with a one-sentence rejection
rationale per alternative. If A is chosen (likely), the rationale
records why C's sub-bands were not worth the noise.

### Classification criteria

Each row in the audit applies these criteria in order:

1. **HIDE** if no consumer in `packages/cli/src/**` imports the
   name and no test in `packages/engine/src/**/*.test.ts` imports
   it from the package entry point (`@run2max/engine`) — only via
   relative paths. The export was on the surface for historical
   reasons and can be removed without breaking any current caller.
2. **FOLD** if the export is consumed but its functionality
   duplicates or shallow-wraps a sibling export, and a deeper API
   would replace both. Example: if `loadUserTemplates` and
   `resolveTemplate` are always called together by `loadPlan`, a
   `resolvePlan(options)` that returns the resolved Plan plus its
   resolved template would replace three exports with one. The
   FOLD row records the deeper API's name and a sentence of why
   the fold improves the surface.
3. **KEEP** otherwise. The export stays public. The row records
   the target banner.

The criteria are applied per export, not in aggregate. A single
shallow export might be KEEP if no deeper API exists; a cluster of
three might FOLD into one.

## Acceptance criteria

- The manifest file exists at
  `context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md`.
- Every current public export in `packages/engine/src/index.ts`
  appears in the audit table with a non-empty classification. No
  export is silently omitted. Verified by counting the rows against
  the export list extracted from `index.ts`.
- The KEEP count is ≤30. If the audit cannot reach ≤30 without
  triggering FOLD work that exceeds this parent's scope, the
  manifest records the mismatch and proposes the metric
  renegotiation as an open question for the AAR — it does not
  silently exceed 30.
- Every HIDE row's rationale is verified by grep against
  `packages/cli/src/**`. No HIDE row is taken on faith.
- Every FOLD row names a deeper API and a one-sentence
  justification. FOLD without a deeper API is a HIDE in disguise
  and gets reclassified.
- The chosen grouping shape is recorded with a one-sentence
  rejection rationale per alternative.
- The cross-package consumer index lists every engine import in
  `packages/cli/src/**`. Verified by grep.
- The open-questions section lists any sub-issue candidates the
  audit surfaced.
- No source files in `packages/engine/src/**` or
  `packages/cli/src/**` are modified by this sub-issue.

## Proposed tests

No tests. This sub-issue produces a decision document, not code.
Verification is by review against:

- The cycle PRD's success metric (≤30 exports).
- The cycle PRD's encounter statement (top-level banners match
  `ubiquitous-language.md`).
- The grep-derived CLI consumer index (every HIDE row is justified
  against this index).

If the manifest passes review, sub-issue #49 is created to apply it.
If review surfaces a contested classification, the manifest is
revised before sub-issue #49 is opened.

## Affected artifacts

**Created**:

- `context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md`
  — the audit deliverable.

**Modified**: none. This sub-issue does not touch source.

**Deleted**: none.

## Dependencies

- Upstream: parents #32, #35, #38, #41, #44 (all closed) — provide
  the stable internal seams the audit operates over.
- Upstream: `context/ubiquitous-language.md` — the glossary against
  which classifications are checked.
- Tooling: grep against the workspace (no test runner needed for
  this sub-issue's own deliverable; the parent's verification suite
  runs on the apply sub-issue).
- No external dependencies. No network. No filesystem state beyond
  the manifest file.
