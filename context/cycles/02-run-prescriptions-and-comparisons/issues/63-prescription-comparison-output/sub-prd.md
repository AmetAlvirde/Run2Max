# Parent Issue #63 -- Prescription Comparison Output

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Expose the structured single-Run Prescription Comparison from parent #60 through
Run2Max's user-facing output formats. Markdown should give the runner readable
evidence, while JSON and YAML should preserve a structured section that tests
and future history lookup can consume without scraping prose.

This parent owns formatter and Output Profile exposure only. It does not read
prior Analysis Artifacts, compute comparable-history deltas, choose YAML-vs-JSON
history precedence, or add new comparison metrics.

## Owned user stories

From the cycle PRD:

- As a runner quantifying a FIT File from a planned interval day, I see whether
  the captured lap sequence matched the Prescribed Run, so I can review the Run
  against what I intended to execute.
- As a maintainer adding the feature, I can test formatting through structured
  data, so output wording changes do not break the behavior contract.

This parent does not own the comparable-history story. It makes the current
Run's Prescription Comparison visible in saved output so the later history
parent has a stable Analysis Artifact surface to inspect.

## Encounter statements affecting this scope

- A runner running `run2max quantify path/to/run.fit --plan . --format yaml`
  first encounters normal AnalysisResult sections plus a structured
  `prescription_comparison` section when a matching Prescribed Run exists.
- A runner reading Markdown output sees a factual Prescription Comparison
  section that names the Prescribed Run, reports available or unavailable
  status, and shows step evidence without coaching conclusions.
- A maintainer opening formatter code first sees the Prescription Comparison
  treated as an AnalysisResult section, not as a recomputation of association,
  lap matching, or Target Range logic.

## Directional dependencies on other sub-PRDs

- Upstream: closed parent #53 provides Prescribed Run and Prescribed Step data,
  including inline Target Ranges preserved from Prescription Notation.
- Upstream: closed parent #59 provides `prescribedRunContext` on AnalysisResult
  when a Run is associated with one intended Prescribed Run.
- Upstream: closed parent #60 provides `AnalysisResult.prescriptionComparison`
  with available and unavailable states for single-Run comparison.
- Downstream: comparable-history deltas consume saved detailed YAML/JSON
  Analysis Artifacts that may include the structured Prescription Comparison
  exposed here.
- Downstream: history artifact validation still owns detailed-profile
  eligibility, missing-artifact and partial-artifact reasons, and same-basename
  YAML/JSON ambiguity rules.

## Domain language

No new domain terms are introduced. This parent uses existing glossary terms:
**Quantify**, **AnalysisResult**, **Analysis Artifact**, **Output Profile**,
**Prescription Comparison**, **Prescribed Run**, **Prescribed Step**, **Target
Range**, **Run**, **FIT File**, **Segment**, **Comparison Group**, and **RPE**.

Boundary scenarios checked against `context/ubiquitous-language.md`:

- A rendered Markdown section is output for a **Prescription Comparison**; it is
  not a new comparison engine and must not alter the structured comparison
  rules.
- JSON and YAML outputs are **Analysis Artifacts** only when saved by the
  runner; this parent formats the data but does not decide historical
  eligibility.
- An **Output Profile** may include or exclude the **Prescription Comparison**
  section, but default runner-facing output should expose it when present.
