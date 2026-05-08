1. Did it go as planned? Yes -- sub-issue #42 delivered the full parent #41 scope and all acceptance criteria are met.
2. What changed from the parent issue plan: No scope expansion was required; the formatter extraction, engine re-export update, and test-boundary split landed in one slice with behavior preserved.
3. ADRs made during this parent issue (reference INDEX.md rows): ADR 0004 (Plan-status formatters live in engine formatters and remain engine-public exports) was added and accepted (`context/adr/INDEX.md`).
4. New considerations or constraints surfaced: The engine/presentation seam can be validated with import-graph inspection plus package DTS build verification; tests alone are necessary but not sufficient for closure confidence.
5. Patterns across sub-issue AARs: A single vertical slice worked because interface decisions were made up front (design-it-twice), then implementation followed the pre-chosen seam.
6. Carry-forward -- flags to write in the cycle, notes for the PRD AAR: The cycle PRD formatter-location open question is now resolved in implementation (engine `formatters/plan.ts`, re-exported from engine `index.ts`).
