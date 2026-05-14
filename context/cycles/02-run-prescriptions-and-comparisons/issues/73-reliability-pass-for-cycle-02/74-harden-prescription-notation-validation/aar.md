# AAR — Sub-issue #74: Harden Prescription Notation validation

1. **Did it go as planned?** Yes — all proposed tests were implemented and pass; the design-it-twice choice (Alternative A) was applied as specified.

2. **What changed from the sub-issue plan:**
   - No deviations from the interface design. `requireTargetRanges: "comparable"` is the production mode; `NON_COMPARABLE_LABELS = {"E", "LR", "REC"}` is the v1 classification; `MAX_REPEAT_COUNT = 50` is the v1 cap.
   - The `parsedRange` local in `parseStep` was introduced as a deepening to avoid re-parsing `match.groups.min/max` twice — one pass for validation, one for the return value.
   - The `PrescriptionDiagnostic.code` union was extended with `invalid_target_range`, `invalid_step_target`, and `repeat_count_out_of_range`.

3. **Carry-forward:**
   - **ADR 0006** documents the comparable-label classification and repetition cap as public grammar decisions (parent flag resolved).
   - Sub-issue #75 (diagnostic propagation through `loadPlan`) depends on the new `invalid_target_range`, `invalid_step_target`, and `repeat_count_out_of_range` codes — it must preserve all codes when propagating errors, not only `syntax` and `missing_target_range`.
   - `PrescriptionDiagnostic.offset` remains declared but never populated — deferred per audit (out of scope for #74; #75 may address or explicitly defer in its AAR).
   - The short-circuit-on-first-error behavior is unchanged — still returns on the first failing segment. This is audit finding #7, owned by #75.
   - `NON_COMPARABLE_LABELS` is v1 and conservative. If HR-zone or pace-zone training is introduced later, the label set or the comparable-mode policy may need to expand — see ADR 0006 consequences.
