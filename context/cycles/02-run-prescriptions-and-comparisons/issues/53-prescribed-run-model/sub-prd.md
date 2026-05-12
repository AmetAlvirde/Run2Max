# Parent Issue #53 -- Prescribed Run model and notation

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Add the Plan-level prescription foundation for cycle 02: optional
`prescribed_runs` on each Week, named engine types for Prescribed Runs and
Prescribed Steps, and a v1 Prescription Notation parser that expands compact
authored notation into an ordered, lap-aligned step sequence.

This parent stops at the authored Plan contract and parsed structure. It does
not associate a captured Run to a Prescribed Run, compare FIT laps to Prescribed
Steps, render prescription comparison output, or read comparable history
artifacts. Those later parents consume the types and parser output created here.

## Owned user stories

From the cycle PRD:

- As a runner authoring a Plan, I write compact Prescription Notation such as
  `1.6K @ E[205-234W] -> 4(3min @ SUB-T[260-280W]/1min @ E) -> 1.6K @ E`, so I
  do not maintain a hand-expanded step list.
- As a runner whose zones change after a Testing Period, I keep old Prescribed
  Step Target Ranges in the notation, so historical comparisons do not depend on
  the current config file.
- As a maintainer adding the feature, I can test parsing through structured
  data, so output wording changes do not break the behavior contract.

## Encounter statements affecting this scope

- A runner opening a Week in `plan.yaml` first encounters its Week Type and its
  compact `prescribed_runs` list together.
- A maintainer opening the Plan parsing code first encounters Prescribed Run and
  Prescribed Step as named domain types, not formatter-owned shapes or raw YAML
  fragments.

## Directional dependencies on other sub-PRDs

- Upstream: cycle 01's named Plan interfaces and Plan-walking seams are already
  closed. This parent builds on those stable Plan types and does not reopen
  their public shape decisions except to add optional Week-level Prescribed Run
  data.
- Downstream: Run-to-Prescribed-Run association depends on the Week-level
  Prescribed Run shape and the date/day metadata defined here.
- Downstream: lap-aligned step comparison depends on the parser's expanded
  Prescribed Step order, distance/duration targets, intensity labels, and inline
  Target Ranges.
- Downstream: formatter and history-comparison parents consume the structured
  Prescribed Run and Prescribed Step data produced here rather than reparsing
  authored notation.

## Domain language

No new domain terms are introduced. This parent uses existing glossary terms:
**Plan**, **Week**, **Prescribed Run**, **Prescription Notation**, **Prescribed
Step**, **Target Range**, **Comparison Group**, **Run**, **FIT File**,
**Segment**, **Testing Period**, and **AnalysisResult**.

Boundary scenarios checked against `context/ubiquitous-language.md`:

- A Tuesday planned unit before capture is a **Prescribed Run**, not a **Run**.
- Expanded notation produces **Prescribed Steps** intended to line up with FIT
  lap-derived **Segments**, but this parent does not perform that comparison.
- Numeric comparison targets come from inline **Target Ranges**, not from the
  current Zone values after a later **Testing Period**.
