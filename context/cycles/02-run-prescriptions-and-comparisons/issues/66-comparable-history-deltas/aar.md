1. Did it go as planned? Yes -- parent #66 delivered comparable-history lookup/classification, deterministic delta computation, `quantify` attachment, and Markdown/JSON/YAML formatter exposure through the planned seams across sub-issues #67-#70.
2. What changed from the parent issue plan:
- Descriptor and delta-domain types were kept near their owning modules (`plan/history.ts`, `computations/comparable-history.ts`) and re-exported from the engine surface, rather than centralizing every new type in `types.ts`.
- `QuantifyOptions.currentFitBasename` was added and CLI-wired from existing FIT path context to support explicit current-artifact exclusion without adding a new CLI flag.
- Formatter rendering stayed inside the existing `prescription_comparison` owner and profile gate, including a defensive empty-runs fallback, instead of introducing a new section or presentation model.
- Non-finite numeric values (`NaN`, `Infinity`) are treated as missing-value unavailable reasons to preserve deterministic and non-fabricated comparable-history output.
3. ADRs made during this parent issue (reference INDEX.md rows):
- None. Decisions remained local, reversible, and already captured by sub-issue design-it-twice notes and parent flags; no qualifying hard-to-reverse architectural trade-off emerged.
4. New considerations or constraints surfaced:
- Same-basename YAML/JSON ambiguity must remain explicit (`ambiguous_artifact`) to avoid silently choosing a conflicting source of truth.
- Detailed-profile eligibility is enforced by data presence (`capturedDate`, `comparisonGroup`, and required actual fields) rather than by a profile label string.
- Comparable-history rendering must preserve missing-value reasons as first-class output, not inferred zeros or omitted rows.
5. Patterns across sub-issue AARs:
- Stable seam progression worked well: reader -> delta helper -> quantify integration -> formatter exposure.
- Structured unavailable reasons improved locality and testability across all layers (reader, arithmetic, integration, rendering).
- Interface-first behavior tests through public surfaces (`readHistoryArtifacts`, `computeComparableHistoryDelta`, `quantify`, `formatResult`) kept refactors safe and minimized coupling to internals.
6. Carry-forward -- flags to write in the cycle, notes for the PRD AAR:
- No new cycle-level flags are required from parent #66.
- Parent #66 closure checks are satisfied: sub-issues closed, parent flags resolved, formatter/integration behavior covered, `pnpm test` and `pnpm build` green.
- PRD open-question notes should record that detailed-profile eligibility and same-basename ambiguity handling are now resolved by implementation in this parent.
