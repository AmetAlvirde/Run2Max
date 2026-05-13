# Parent Issue #60 -- Lap-aligned Prescription Comparison

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

When a captured Run has been associated with a Prescribed Run, Run2Max should
compare the actual lap-derived Segment sequence to the Prescribed Run's expanded
Prescribed Steps by order. The result is structured Prescription Comparison data
on `AnalysisResult` that says either comparison is available or why it is
unavailable.

This parent owns single-Run comparison only: step count compatibility,
prescribed-vs-actual completion evidence, power Target Range evidence, heart
rate, pace, run-level RPE evidence, and asymmetric Completion Tolerance for
classifying each step as within tolerance, short, or long. It does not render the
final Markdown, YAML, or JSON section and does not read comparable-history
artifacts or compute prior-Run deltas.

## Owned user stories

From the cycle PRD:

- As a runner quantifying a FIT File from a planned interval day, I see whether
  the captured lap sequence matched the Prescribed Run, so I can review the Run
  against what I intended to execute.
- As a maintainer adding the feature, I can test comparison through structured
  data, so output wording changes do not break the behavior contract.

This parent does not own the comparable-history story. It produces the current
Run's structured comparison data that later history work can consume.

## Encounter statements affecting this scope

- A runner running `run2max quantify path/to/run.fit --plan . --format yaml`
  eventually sees a structured prescription-comparison section when a matching
  Prescribed Run exists. This parent creates the structured data for that
  section; formatter parents decide the rendered shape.
- A maintainer opening the comparison code first sees FIT laps treated as the
  actual boundary source, not a hidden interval-detection heuristic.
- A runner with missing or incompatible FIT laps gets an unavailable comparison
  reason instead of fabricated step evidence.

## Directional dependencies on other sub-PRDs

- Upstream: closed parent #53 provides `PrescribedRun.steps`, `PrescribedStep`,
  distance/duration targets, intensity labels, and inline power Target Ranges.
- Upstream: closed parent #59 provides `prescribedRunContext` on
  `AnalysisResult` when the captured Run has been associated with one intended
  Prescribed Run.
- Upstream: existing Segment computation produces lap-derived `SegmentRow` data
  from FIT lap markers.
- Downstream: formatter output consumes the structured Prescription Comparison
  data from this parent and decides Markdown, YAML, and JSON exposure.
- Downstream: comparable-history deltas consume the matched Comparison Group and
  the current Run's structured evidence, but history artifact lookup remains out
  of scope here.

## Domain language

This parent introduces **Prescription Comparison** and **Completion Tolerance**
as glossary terms. It uses existing terms **Run**, **FIT File**, **Segment**,
**Prescribed Run**, **Prescribed Step**, **Target Range**, **RPE**,
**AnalysisResult**, and **Comparison Group**.

Boundary scenarios checked against `context/ubiquitous-language.md`:

- A **Prescription Comparison** compares one captured **Run** to one associated
  **Prescribed Run**; it is not a coach's conclusion about training quality.
- Actual boundaries come from FIT lap-derived **Segments**; a raw-record pattern
  that looks interval-like is not enough to create comparison steps.
- **Target Range** values on **Prescribed Steps** remain the numeric power
  target; this parent must not look up mutable Zone values from current config.
- **Completion Tolerance** classifies duration and distance completion; it does
  not decide whether comparison is available.
