# AAR — Sub-Issue #75: Preserve Actionable Prescription Diagnostics

1. **Did it go as planned?** Yes — all acceptance criteria met with no scope changes.

2. **What changed from the sub-issue plan:**
   - No deviations. All five behaviors landed as specified: `offset` removed,
     nested repetition reports `unsupported`, independent failing steps return
     multiple diagnostics, `parsePlan` throws `PrescriptionNotationError` with
     structured diagnostic payload, `loadPlan` re-throws with file path context
     as the same typed error.
   - `PrescriptionNotationError` and `PrescriptionDiagnostic` were added to the
     public `@run2max/engine` surface (`index.ts`) since CLI consumers need
     `instanceof` checks to handle prescription errors distinctly from schema
     errors.

3. **Carry-forward:**
   - ADR 0007 ratifies the eager-throw vs. result-type decision for `parsePlan`.
     No flag needed in the parent; the ADR satisfies the parent issue acceptance
     criterion directly.
   - Sub-issues #76 and #77 are independent of this interface; no flags required.
   - Parent issue closure should verify that `loadPlan` error handling in the CLI
     (`quantify`, `sync`, `validate` commands) takes advantage of
     `PrescriptionNotationError.diagnostics` for richer user output — this is a
     deepening opportunity, not a must-fix for #73.
