1. Did it go as planned? Yes -- the formatter fold landed as designed with byte-identical CLI behavior and no rendering-logic changes.
2. What changed from the sub-issue plan: No material API or scope changes; implementation kept the two existing formatter helpers exported from `formatters/plan.ts` for in-package tests while removing their public re-exports.
3. Carry-forward -- flags to write in the parent, divergence to note for future siblings, notes for the parent issue's AAR:
   - Parent flag `[48-audit-and-grouping-design -> 51-plan-status-formatter-fold]` is resolved.
   - Public export count is now 32; parent #47 remains 2 over the `<= 30` target and must record metric renegotiation rationale at parent close per existing parent flag.
