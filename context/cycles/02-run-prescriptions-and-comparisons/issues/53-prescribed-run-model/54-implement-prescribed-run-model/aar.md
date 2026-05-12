1. Did it go as planned? Yes -- the Week-level `prescribed_runs` shape, notation
   parser, and step expansion landed together with passing tests.
2. What changed from the sub-issue plan: No meaningful scope change;
   implementation matched Alternative A (parsed Plan owns authored metadata plus
   expanded steps).
3. Carry-forward -- flags to write in the parent, divergence to note for future
   siblings, notes for the parent issue's AAR: No flags written. Downstream
   parents should treat `PrescribedRun.steps` as the canonical parsed
   representation and use `PrescribedRun.prescription` only for
   display/diagnostics.
