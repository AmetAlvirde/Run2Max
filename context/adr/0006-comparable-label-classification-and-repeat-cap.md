# Comparable intensity label classification and v1 repetition cap

_Made during: cycle 02 — Run Prescriptions and Comparisons / parent #73 — Reliability Pass / sub-issue #74_
_Scope: product_
_Status: accepted_

The parser owns the policy for which intensity labels require an inline Target
Range. A fixed `NON_COMPARABLE_LABELS` set (`E`, `LR`, `REC`) identifies
easy/recovery steps that may omit Target Ranges; all other labels are treated as
numerically comparable and require a Target Range when `requireTargetRanges:
"comparable"` is active. `parsePlan` always uses comparable mode. A fixed v1
repetition cap of 50 guards against typo-amplified expansion.

## Considered options

**A (chosen) — Parser-owned set, Plan-load enforcement.** `NON_COMPARABLE_LABELS`
lives next to the grammar it interprets. `parsePlan` activates comparable mode
unconditionally. Tests cover each boundary; no caller duplication.

**B — Caller-supplied predicate.** `targetRangeRequiredFor?: (label) => boolean`
gives callers flexibility, but cycle 02 has one production policy. The seam
would add configuration surface without a second real adapter.

**C — Post-parse validation pass.** A separate `validateParsedPrescription`
inside `parsePlan` keeps the parser permissive, but standalone parser callers
would then observe a weaker contract than production Plan loading.

## Consequences

- Adding a label to `NON_COMPARABLE_LABELS` is backward-compatible; removing one
  may reject previously valid plans.
- Raising `MAX_REPEAT_COUNT` above 50 is backward-compatible; lowering it would
  reject plans with higher counts.
- If a second validation policy emerges (e.g. HR-zone training), revisit option B
  before expanding the label set.
