1. Did it go as planned? Yes -- sub-issue #45 consolidated the four targeted helpers into single canonical homes and updated all known callers without behavior changes.
2. What changed from the sub-issue plan: No design split required a sibling sub-issue; chosen homes were implemented directly (`plan/dates.ts`, `plan/clone.ts`, `plan/case-keys.ts`, `computations/utils.ts`) and `km-splits` inlined `?? 0` at call sites to preserve its prior non-null behavior.
3. Carry-forward -- flags to write in the parent, divergence to note for future siblings, notes for the parent issue's AAR:
   - Verification gates passed at close: workspace tests (`pnpm test`) and engine DTS build (`pnpm --filter @run2max/engine build`).
   - Grep-based duplication checks are satisfied for the targeted function definitions (`addDays`, `clonePlan`, `getDistance`) and the case-transform pair now has one canonical module.
   - No unresolved outward flags were identified for active siblings under this parent (none planned).
