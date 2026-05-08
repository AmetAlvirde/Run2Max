1. Did it go as planned? Yes -- the template fold landed with byte-compatible CLI behavior and no scope expansion.
2. What changed from the sub-issue plan: No material design changes; one test assertion was adjusted to avoid assuming filesystem directory ordering while still asserting user-templates-first then builtins behavior.
3. Carry-forward -- flags to write in the parent, divergence to note for future siblings, notes for the parent issue's AAR:
   - Parent flag `[48-audit-and-grouping-design -> 50-template-api-fold]` is resolved.
   - Public export count is now 33; parent #47 still depends on sub-issue #51 to reach `<= 30`.
