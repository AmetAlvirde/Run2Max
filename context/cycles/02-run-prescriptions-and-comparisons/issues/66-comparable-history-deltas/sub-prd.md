# Parent Issue #66 -- Comparable-History Deltas

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

When a captured Run is associated with a Prescribed Run carrying a Comparison
Group, Run2Max should surface factual deltas against prior Runs in the same
Comparison Group. Prior Runs are read from saved detailed YAML/JSON Analysis
Artifacts paired to their FIT File by basename in the Block folder. The result
is structured comparable-history data attached to the current Run's
Prescription Comparison, plus rendered exposure through the existing
`prescription_comparison` Output Profile section.

This parent owns history Analysis Artifact discovery, detailed-profile
eligibility, key-case normalization between YAML and JSON, same-basename
ambiguity behavior, comparable-history delta computation, and formatter
exposure of prior-Run deltas. It does not change Plan schema, Prescription
Notation parsing, FIT lap interpretation, Prescribed Run association rules,
single-Run comparison semantics, or introduce a persistence database.

## Owned user stories

From the cycle PRD:

- As a runner comparing week 1 and week 4 versions of the same interval
  session, I see factual deltas for power, heart rate, pace, and RPE, so I can
  judge whether the later Run was controlled better at similar work.
- As a maintainer adding the feature, I can test history lookup, eligibility,
  and delta computation through structured data, so output wording changes do
  not break the behavior contract.

This parent does not own the lap-aligned comparison story or the prescription
notation authoring story. It consumes the single-Run Prescription Comparison
data from parent #60 and the rendered surface from parent #63 to deliver
prior-Run deltas in the same Comparison Group.

## Encounter statements affecting this scope

- A runner running `run2max quantify path/to/run.fit --plan . --format yaml`
  on a Prescribed Run with a Comparison Group first encounters the structured
  `prescription_comparison` section augmented with prior-Run deltas when
  detailed-profile Analysis Artifacts for earlier Runs in that Comparison Group
  exist in the Block folder.
- A runner reviewing a repeated interval session in Markdown first sees
  current-vs-prior deltas only for Runs sharing an explicit Comparison Group;
  Runs without a Comparison Group keep their current single-Run output.
- A runner whose prior YAML/JSON Analysis Artifact lacks the required detailed
  sections first encounters a labeled unavailable reason rather than a fabricated
  delta row or a silently missing comparison.
- A maintainer opening the history lookup code first sees same-basename
  YAML/JSON pairing and detailed-profile eligibility as explicit gates, not as
  hidden filesystem heuristics.

## Directional dependencies on other sub-PRDs

- Upstream: closed parent #53 provides `PrescribedRun`, `PrescribedStep`, and
  inline Target Ranges preserved from Prescription Notation. Comparison Groups
  authored on Prescribed Runs are the membership key for history lookup.
- Upstream: closed parent #59 provides `prescribedRunContext` on
  `AnalysisResult` with the matched `comparisonGroup` value.
- Upstream: closed parent #60 provides `AnalysisResult.prescriptionComparison`
  with available and unavailable single-Run states and `comparisonGroup` on
  `PrescriptionComparisonRunContext`.
- Upstream: closed parent #63 exposes `prescription_comparison` through
  Markdown, JSON, and YAML formatters via the Output Profile section gate. This
  parent extends that section with prior-Run delta evidence without changing
  the section name or profile vocabulary.
- Upstream: existing block-folder convention from parent #59 (`scanBlockRuns`
  reads `.fit` files in a directory) defines the directory shape this parent
  scans for sibling Analysis Artifacts.
- Downstream: a future week-level adherence view may consume the same history
  lookup contract; this parent must not require a separate contract for that.

## Domain language

This parent introduces **Analysis Artifact**, **Detailed Profile**, and
**Comparable-History Delta** as glossary terms (subject to
`sdp-domain-validate` review before parent closure). It uses existing terms
**Run**, **FIT File**, **Block**, **Prescribed Run**, **Prescription
Comparison**, **Comparison Group**, **Segment**, **Output Profile**, **RPE**,
**Average Power**, **Average Heart Rate**, **Maximum Heart Rate**, and
**Average Pace**.

Boundary scenarios checked against `context/ubiquitous-language.md`:

- An **Analysis Artifact** is a saved YAML or JSON output produced by
  `run2max quantify`. A loose YAML or JSON file written by hand is not an
  Analysis Artifact unless it carries the same structured sections.
- A **Detailed Profile** is the Output Profile whose `sections` and `columns`
  vocabulary covers everything required to reconstruct comparable evidence.
  An artifact saved under a custom profile that omits the relevant section is
  not Detailed-Profile-eligible.
- A **Comparable-History Delta** is a deterministic numeric delta from a prior
  Run's actual evidence to the current Run's actual evidence for one metric;
  it is not a training inference, readiness score, or coaching conclusion.
- A **Comparison Group** is a Prescribed Run membership tag. History deltas
  only consider artifacts whose recorded Comparison Group equals the current
  Run's.
