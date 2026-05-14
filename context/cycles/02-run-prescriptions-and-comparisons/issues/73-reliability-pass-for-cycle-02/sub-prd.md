# Parent Issue #73 -- Reliability Pass for Cycle 02

> Translated to `issue.md`. This sub-PRD records the product-level intent --
> user stories and dependencies. Update `issue.md` for ongoing technical work.
> Update this file only if the underlying user stories themselves change.

## Scope

Resolve the must-fix audit findings that block moving cycle 02 from Prototype to
Reliable. This parent coordinates the reliability work across the existing cycle
02 seams without reopening the already-accepted product scope for run
prescriptions, lap-aligned comparison, prescription-comparison output, or
Comparable-History Deltas.

The pass is intentionally narrow. It fixes validation gaps, diagnostic loss,
silent override failures, and current-run exclusion in comparable history. It
does not add new prescription grammar features, new output sections, new
history-matching rules, or trailing-lap tolerance.

## Owned user stories

From the cycle PRD and audit findings:

- As a runner authoring a Plan, invalid Prescription Notation fails with
  actionable diagnostics, including missing Target Ranges on numerically
  comparable intensity steps, so bad plan data does not silently enter
  comparison.
- As a runner authoring a Plan, impossible targets such as reversed power
  ranges, zero-length steps, and typo-amplifying repetition counts are rejected
  before a Run is analyzed.
- As a runner using `--prescribed-run`, override failures are visible and
  labeled, so a moved or ambiguous Run does not produce output that looks
  unassociated by accident.
- As a runner comparing against prior Analysis Artifacts, the current FIT File
  is never considered a history candidate, including when its extension is
  written as `.FIT`.
- As a maintainer closing cycle 02, every must-fix audit finding is resolved or
  explicitly handled with closure evidence, so the Reliable claim rests on tests
  and documented decisions rather than audit notes alone.

## Encounter statements affecting this scope

- A runner loading `plan.yaml` first encounters invalid Prescription Notation at
  the Plan boundary with structured, file-contextual diagnostics.
- A maintainer reading the parser first encounters the rule that Target Ranges
  are required per numerically comparable Prescribed Step, not through a blunt
  all-steps switch.
- A runner passing `--prescribed-run` first encounters a failed override as a
  CLI error, not as missing prescription-comparison output.
- A maintainer reading Comparable-History Delta code first encounters a single
  basename rule that treats `.fit` and `.FIT` as the same FIT File extension.
- A cycle closer first encounters the reliability pass as a single parent issue
  with sub-issues ordered by seam and closure evidence.

## Directional dependencies on other sub-PRDs

- Upstream: parent #53 provides the Prescribed Run model, Prescription Notation
  parser, Plan schema seam, and parser diagnostics that sub-issues #74 and #75
  harden.
- Upstream: parent #59 provides `findPrescribedRun`, CLI override parsing, and
  `quantify` prescription association that sub-issue #76 makes loud on explicit
  override failure.
- Upstream: parent #66 provides history artifact discovery and
  Comparable-History Delta integration that sub-issue #77 hardens for
  current-run exclusion.
- Downstream: cycle 02 closure depends on all four sub-issues resolving their
  acceptance criteria and running repository verification.
- No downstream feature parent should consume partial reliability-pass behavior
  until the parent issue is closed or explicitly flagged.

## Domain language

No new runner-domain terms are introduced. This parent uses existing glossary
terms: **Plan**, **Prescribed Run**, **Prescription Notation**, **Prescribed
Step**, **Target Range**, **Run**, **FIT File**, **Analysis Artifact**,
**Prescription Comparison**, **Comparable-History Delta**, and **Comparison
Group**.

Process and implementation phrases such as `Reliability Pass`, `audit finding`,
`actionable diagnostic`, and `override failure` are not domain terms a runner
would use to describe training data, so they are intentionally not added to
`context/ubiquitous-language.md`.

Boundary scenarios checked against `context/ubiquitous-language.md`:

- A malformed authored prescription is invalid **Prescription Notation** on a
  **Prescribed Run**, not a malformed **Run**.
- A missing inline watts range is a missing **Target Range** for a **Prescribed
  Step**; current **Zone** values are not substituted.
- A prior saved YAML/JSON file is an **Analysis Artifact** candidate for a
  **Comparable-History Delta** only if it belongs to a different **FIT File**
  basename than the current **Run**.
