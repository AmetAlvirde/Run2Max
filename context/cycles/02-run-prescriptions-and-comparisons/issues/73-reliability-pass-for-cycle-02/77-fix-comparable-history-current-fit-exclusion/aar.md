# AAR -- Sub-Issue #77: Fix comparable-history current FIT exclusion

1. Did it go as planned? Yes -- one-line summary: two-line fix in `history.ts`
   replaced case-sensitive `.fit` with `/\.fit$/i` regex; all four proposed
   tests pass.

2. What changed from the sub-issue plan:
   - No deviations. Alternative A was applied exactly as designed:
     `isFitFileName` and `stripFitExtension` logic inlined at the discovery site
     using regex rather than helper functions (same behavior, less indirection).
   - No ADR authored -- the design-it-twice rationale in the sub-issue is the
     full record; this is a bug fix, not a consequential architectural decision.
   - `packages/cli/src/commands/quantify.ts` unchanged as predicted.

3. Carry-forward -- flags to write in the parent, divergence to note for future
   siblings, notes for the parent issue's AAR:
   - No flags needed. The history-reader seam is isolated and the fix has no
     downstream callers that need updating.
   - Parent #73 acceptance criterion "Comparable-history candidate discovery
     excludes the current FIT File regardless of `.fit` extension case" is now
     satisfied with regression evidence.
   - `pnpm test`: 635 passed, 6 skipped, 0 failed.
