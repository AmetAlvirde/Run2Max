# AAR -- Parent Issue #73: Reliability Pass for Cycle 02

1. Did it go as planned? Yes -- the reliability-layer refactor closed the
   Prototype-to-Reliable gap for cycle 02 by resolving all must-fix audit
   findings through sub-issues #74 through #77.

2. What changed from the parent issue plan:
   - Scope stayed audit-driven. The pass hardened existing cycle 02 seams rather
     than adding new Prescription Notation grammar, new output sections, new
     history matching rules, or trailing-lap tolerance.
   - Sub-issue #74 made Plan loading enforce comparable-mode Target Range
     validation, numeric Target Range invariants, positive step targets, and the
     v1 repetition cap. The implemented and documented cap is
     `MAX_REPEAT_COUNT = 50`.
   - Sub-issue #75 preserved actionable diagnostics by removing the unused
     `offset` field, returning multiple independent diagnostics, reporting nested
     repetition as `unsupported`, and propagating `PrescriptionNotationError`
     through `parsePlan` and `loadPlan` with structured diagnostics intact.
   - Sub-issue #76 made explicit `--prescribed-run` failures loud at the
     engine/CLI seam while keeping default association failures non-fatal.
   - Sub-issue #77 fixed Comparable-History Delta candidate discovery so the
     current FIT File is excluded regardless of `.fit` extension case.

3. ADRs made during this parent issue (reference INDEX.md rows):
   - ADR 0006 -- Comparable intensity label classification and v1 repetition
     cap.
   - ADR 0007 -- `parsePlan` throws typed `PrescriptionNotationError` rather
     than returning a result type.

4. New considerations or constraints surfaced:
   - Reliable assurance depends on validating authored Prescription Notation at
     the Plan boundary, not only through standalone parser calls.
   - `NON_COMPARABLE_LABELS` (`E`, `LR`, `REC`) is intentionally conservative;
     future HR-zone or pace-zone training may require a new validation policy.
   - CLI output can be deepened later to render `PrescriptionNotationError`
     diagnostics more richly across `quantify`, `sync`, and `validate`, but the
     structured error payload now exists and is preserved.
   - The audit's non-must-fix test gaps remain accepted debt: interleaved arrow
     types, `→` inside repetition bodies, leading/trailing whitespace and
     lone-arrow inputs, and explicit fixture-without-`prescribed_runs`
     round-trip coverage. These do not block Reliable because the must-fix
     parser, loader, override, and history-reader contracts are now covered at
     their owning seams.
   - The explicit `no_week` override-failure path is covered by the same engine
     throw matrix as `no_prescribed_run`; a separate CLI assertion would be
     redundant for this parent closure.

5. Patterns across sub-issue AARs:
   - The fixes stayed at owning seams: parser/schema validation in plan code,
     diagnostic propagation at Plan loading, explicit override failure at the
     engine/CLI boundary, and FIT extension normalization in the history reader.
   - Tests were added at the narrowest reliable seam: parser and schema tests for
     Plan validity, loader tests for file-context diagnostics, engine/CLI tests
     for override failure, and filesystem-backed history-reader tests for FIT
     extension casing.
   - No new ports, services, persistence, caches, or collaborator-owned
     dependencies were introduced.

6. Carry-forward -- flags to write in the cycle, notes for the PRD AAR:
   - Reliability Pass:
     Final Assurance Level: Reliable.
     Assurance Changes: Prototype -> Reliable through parent #73 after the
     feature set was complete.
     Scope: all cycle 02 feature seams named by `opus-audit-findings.md`.
     Must-fix findings resolved: all Parent #53 and Parent #59 must-fix items,
     the Parent #66 uppercase `.FIT` current-run exclusion, and the
     cross-cutting ADR coverage items.
     Deferred findings and rationale: non-must-fix test gaps and out-of-cycle
     opportunities remain documented in `opus-audit-findings.md`; they are not
     required for the cycle 02 PRD's Reliable claim.
     Tests run: `pnpm test` passed with 36 files passed, 1 skipped, 635 tests
     passed, 6 skipped. `pnpm -r build` passed for engine and CLI, including DTS
     for engine.
     ADRs: 0006 and 0007 were added during the reliability pass.
     Lessons learned: reliability refactors should stay audit-driven and close
     the smallest contract-owning seam rather than expanding product scope.
   - No future sibling flags are needed; #73 is the final parent for the cycle 02
     reliability pass.
   - Cycle closure may now treat the reliability-pass parent as complete, subject
     to the PRD-level closure decision.
