# parsePlan throws typed PrescriptionNotationError rather than returning a result type

_Made during: cycle 02 — Run Prescriptions and Comparisons / parent #73 — Reliability Pass / sub-issue #75_
_Scope: product_
_Status: accepted_

`parsePlan` remains a throwing function. When Prescription Notation parsing
fails, it throws `PrescriptionNotationError` — a typed error class carrying
`ReadonlyArray<PrescriptionDiagnostic>` — instead of a plain `Error`. `loadPlan`
catches `PrescriptionNotationError` and re-throws with file path context, still
as `PrescriptionNotationError`, preserving the structured diagnostic payload for
CLI and test assertions.

## Considered options

**A (chosen) — Typed error carrying parser diagnostics.** `parsePlan` keeps
its throwing contract; callers that already handle exceptions need no change.
CLI and tests can `instanceof PrescriptionNotationError` and inspect `diagnostics`
without brittle message parsing. `loadPlan` adds file path context while keeping
the same error class so diagnostics survive the filesystem boundary.

**B — Change Plan loading to a result type.**
`parsePlan` returns `{ ok: true; plan } | { ok: false; diagnostics }`.
Rejected: every existing `parsePlan` caller must be updated or wrapped, which is
a large public contract change for a reliability fix with no second adapter to
justify the seam.

**C — Encode prescription failures as custom ValiError issues.**
Translate parser diagnostics into Valibot issue objects and reuse existing loader
formatting. Rejected: parser diagnostics should not be forced into a
schema-library-specific shape; the coupling would complicate future Valibot
version upgrades.

## Consequences

- `PrescriptionNotationError` and `PrescriptionDiagnostic` are part of the
  public `@run2max/engine` surface; removing them is a breaking change.
- `loadPlan` callers that previously caught a plain `Error` for prescription
  failures now receive `PrescriptionNotationError` — a subclass of `Error`, so
  `catch (err)` handlers still work, but `instanceof Error` checks remain valid.
- If a second Plan-loading consumer needs non-throwing error handling, revisit
  option B with two real adapters to justify the result-type seam.
