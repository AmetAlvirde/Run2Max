# Parent Issue #59 -- Run-to-Prescribed-Run Association

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

When a runner quantifies a captured Run against a Plan, Run2Max needs to identify
the intended Prescribed Run before any lap-aligned comparison can happen.
Default association uses the Run's local date. Explicit override support lets a
runner point comparison at the intended Prescribed Run when the Run moved or the
date match is ambiguous.

This parent stops at producing a structured association result. It does not
compare FIT laps to Prescribed Steps, render prescription-comparison output, or
compute comparable-history deltas.

## Owned user stories

From the cycle PRD:

- As a runner quantifying a FIT File from a planned interval day, I see whether
  the captured lap sequence matched the Prescribed Run, so I can review the Run
  against what I intended to execute.
  > This parent owns only the association that enables the later lap comparison.

- As a runner who moves Tuesday's planned Run to Wednesday, I can override the
  Prescribed Run association, so comparison follows intent rather than calendar
  accident.

- As a maintainer adding the feature, I can test association through structured
  data, so output wording changes do not break the behavior contract.

## Encounter Statements

- A runner running `run2max quantify path/to/run.fit --plan . --format yaml`
  eventually sees a prescription-comparison section only when a Prescribed Run
  has been associated. This parent produces the association input for that later
  section; it does not render the section.

- A runner with a moved Run needs a simple explicit override at the quantify
  access surface. The exact flag name and value shape remain a decision to make
  before implementation, not a decision closed by this sub-PRD.

- A maintainer opening the association code first sees a pure lookup over parsed
  Plan data that returns a matched Prescribed Run with its owning Week context or
  a labeled unavailable reason.

## Directional Dependencies

- Upstream: closed parent #53 delivers Prescribed Run, Prescribed Step, Target
  Range, `prescribedRuns` on each Week, and expanded `PrescribedRun.steps`.
- Upstream: cycle 01 parent #35 delivers `walkPlan` and Week Context traversal;
  this parent must reuse that seam rather than create a second Plan traversal.
- Upstream: existing Run-to-Week association already provides local-date Week
  matching for Plan Context enrichment.
- Downstream: lap-aligned step comparison consumes the matched Prescribed Run and
  its expanded Prescribed Steps.
- Downstream: formatter output consumes comparison data created after this
  association, not the association result alone.
- Downstream: comparable-history deltas consume the matched Prescribed Run's
  Comparison Group.

## Domain Language

No new domain terms are introduced. This parent uses existing glossary terms:
**Prescribed Run**, **Prescribed Step**, **Week**, **Plan**, **Run**, **FIT
File**, **Quantify**, **Plan Context**, and **Comparison Group**.

Boundary scenarios checked against `context/ubiquitous-language.md`:

- Before a FIT File exists, the planned unit is a **Prescribed Run**, not a
  **Run**.
- A **Run** is associated with at most one **Prescribed Run** for comparison,
  normally by local date with an explicit override for moved or ambiguous Runs.
- An explicit override follows the runner's intended **Prescribed Run**; it must
  not be limited to the Week that contains the captured Run's date.
