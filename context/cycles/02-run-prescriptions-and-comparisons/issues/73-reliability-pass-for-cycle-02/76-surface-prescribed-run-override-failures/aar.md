# AAR — Sub-Issue #76: Surface Prescribed-Run Override Failures in CLI

1. **Did it go as planned?** Yes — implemented exactly as designed in Alternative A.

2. **What changed from the sub-issue plan:**
   - Nothing structural. `PrescribedRunOverrideError` was added to `associate.ts` (alongside the types it references) rather than a separate file, which kept it co-located with `FindPrescribedRunReason` and `FindPrescribedRunOptions`.
   - The CLI error message format is `--prescribed-run "<selector>" failed (<reason>): no matching run found in plan`, which satisfies "includes reason and attempted selector" from the interface spec.
   - CLI test used `vi.hoisted()` to define `MockPrescribedRunOverrideError` so it could be referenced both inside the `vi.mock()` factory and in test bodies — a Vitest-specific detail not anticipated in the sub-issue.

3. **Carry-forward:**
   - No flags to write in parent #73 — this sub-issue is independent of #77 and #77 has no assumptions about override-error behavior.
   - Engine test count: +4 (2 in `quantify.test.ts` for throw behavior, 1 regression for non-fatal default, 1 in `associate.test.ts` for cross-week duplicate-date isolation). CLI test count: +2.
   - The `no_week` override-failure reason is covered by the `no_prescribed_run` path in the test matrix (both are `ok: false` and the engine throws regardless of which reason). Explicit `no_week` override test was not added as a separate case; the acceptance criteria is satisfied by the matrix approach.
