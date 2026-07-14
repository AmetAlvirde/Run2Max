# Run Comparison is a distinct concept on an extracted shared metric-delta primitive

_Made during: MVI 2026-06-26 — Compare Runs / (no cycle)_
_Scope: product_
_Status: accepted_

Run Comparison — a deterministic, summary-level delta between two
explicitly-chosen Runs (a baseline and a comparand), independent of any Plan,
Prescribed Run, or Comparison Group — is modeled as its own engine concept rather
than as a generalization of the existing plan-gated Comparable-History Delta. The
genuinely shared logic is extracted into a neutral `numericDelta(left, right)`
primitive (`computations/metric-delta.ts`): coerce each side to finite-or-null,
classify available / missing-side(s), compute `left − right`. Comparable-History
Delta is refactored onto this primitive behavior-preservingly; the Prescription
comparison path is untouched. Each caller maps the neutral result onto its own
field names (`current/prior` vs `baseline/comparand`) and reason vocabulary.

## Considered options

**A (chosen) — Neutral kernel + per-caller concepts.** The reusable core is a
tiny kernel (two nullable numbers → delta-or-reason), not a shared function. Each
concept keeps its own field names, reason vocabulary, and result shape, mapping
onto the neutral kernel. Run Comparison is plan-independent and exported as a
distinct engine surface plus a `run2max compare <baseline> <comparand>` CLI
command.

**B — Generalize Comparable-History Delta to cover both.** One shared typed
comparison function parameterized over source. Rejected: the field names and
reason vocabularies genuinely differ per concept, and Comparable-History Delta is
plan-gated (Comparison Group eligibility, history loading) while Run Comparison is
not. Forcing one function couples a plan-gated path to a plan-independent one and
inverts the natural dependency.

**C — Duplicate the arithmetic in each path.** Simplest short-term, but the
delta/missing-value rules are exactly the logic most worth keeping consistent
across both surfaces; duplication invites drift.

## Consequences

- `numericDelta` is the single contract for delta direction and missing-value
  classification; the 7 existing Comparable-History tests are its regression guard
  and must stay green unchanged.
- Run Comparison becomes public engine surface (`computeRunComparison`,
  extractor/loader, formatter, types) and a CLI contract — costly to rename or
  remove once shipped. The glossary term **Run Comparison** is part of the
  ubiquitous language.
- `delta = comparand − baseline` with pace sign unflipped is the established
  convention; any later sign-flip is itself a contract change.
- A future third comparison surface should map onto `numericDelta` rather than
  reusing either concept's named shape.
