1. Did it go as planned? Yes -- sub-issue #48 delivered the planned decision artifact (`manifest.md`) with a complete 99-export audit, glossary-aligned grouping choice, and no source-code changes.
2. What changed from the sub-issue plan: Scope stayed decision-only as intended; no ADR was authored at sub-issue close because ADR 0005 is explicitly deferred to parent #47 close if rationale remains non-obvious after apply/fold decisions.
3. Carry-forward -- flags to write in the parent, divergence to note for future siblings, notes for the parent issue's AAR:
   - Wrote carry-forward flags in parent #47 for apply work (`49-apply-manifest`) and two fold-design candidates (`50-template-api-fold`, `51-plan-status-formatter-fold`).
   - Closure checks: proposed tests were "No tests" by sub-issue contract; verification was completed by manifest row-count parity against `packages/engine/src/index.ts`, CLI consumer index derivation from `packages/cli/src/**`, and HIDE rationale validation against that index.
   - Outward pass: active parent artifact updated now (`context/cycles/01-deepen-engine/issues/47-public-api-regrouping/issue.md`); no closed-artifact divergence was introduced.
