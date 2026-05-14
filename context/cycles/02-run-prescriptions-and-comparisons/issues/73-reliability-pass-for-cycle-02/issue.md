# Parent Issue #73 -- Reliability Pass for Cycle 02

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- All must-fix findings in
  `context/cycles/02-run-prescriptions-and-comparisons/opus-audit-findings.md`
  are resolved by sub-issues #74 through #77, or a remaining item is explicitly
  deferred in the cycle AAR with rationale approved during closure.
- Plan loading enforces the Prescription Notation validation contract from
  parent #53: numerically comparable intensity steps require Target Ranges,
  Target Ranges obey numeric invariants, zero-length steps are rejected, and the
  repetition-count policy prevents typo-amplified expansion.
- Prescription diagnostics stay actionable across parser, Plan schema, and
  loader boundaries. Diagnostics retain code/token/position context or the
  public diagnostic contract is narrowed before closure.
- Nested repetition reports an unsupported construct rather than a generic
  syntax failure, and malformed multi-step notation can report more than the
  first error when independent steps fail.
- Explicit `--prescribed-run` failures surface at the CLI with non-zero exit and
  a labeled reason for `ambiguous`, `no_prescribed_run`, and `no_week` outcomes.
  Default association failure remains non-fatal unless a sub-issue records a
  different decision.
- Comparable-history candidate discovery excludes the current FIT File
  regardless of `.fit` extension case, and regression tests cover the
  current-run exclusion behavior.
- New tests cover each fixed behavior at the narrowest seam that proves it, with
  CLI tests for CLI-only behavior and engine tests for engine invariants.
- `pnpm test` and `pnpm -r build` pass at parent closure, or any unavailable
  command is recorded as a closure flag with the repository's actual script
  state.
- ADR or AAR coverage records the consequential parser/Plan-loading decisions
  identified by the audit: eager Plan-load failure versus diagnostic collection,
  and the replacement for the binary `requireTargetRanges` decision.

## Implementation approach

1. Execute sub-issue #74 first because it fixes the validation contract that
   Plan loading and diagnostics must carry forward.
2. Execute sub-issue #75 after #74 because diagnostic aggregation and loader
   propagation should report the hardened validation outcomes rather than the
   old parser behavior.
3. Execute sub-issue #76 after prescription validation work because it is a
   separate association/CLI seam and should not mask Plan-loading failures.
4. Execute sub-issue #77 after the CLI/association work because it is isolated
   to Comparable-History Delta candidate discovery and can close independently.
5. Keep every fix at the owning seam: parser validation in the parser/Plan
   schema area, loader context at the loader boundary, explicit override failure
   at the engine/CLI seam, and FIT extension matching in the history reader.
6. Prefer direct tests through existing public interfaces. Do not introduce
   ports unless a sub-issue identifies two real adapters; all planned
   dependencies are in-process or existing local filesystem seams.
7. After the four sub-issues pass, run the parent verification commands and
   update closure artifacts with resolved/deferred findings, ADR/AAR notes, and
   verification evidence.

## Dependencies

- Upstream audit: `opus-audit-findings.md` is the source of must-fix scope.
- Upstream plan: `reliability-pass.md` is the source of sub-issue organization.
- Upstream code: parents #53, #59, and #66 have already landed the relevant
  parser, association, CLI, and history-reader seams.
- Tooling: Vitest and the existing package build/DTS commands provide closure
  evidence. No standalone top-level `typecheck` script is assumed.
- External services: none. The pass does not add network, database, cache, or
  collaborator-owned dependencies.

## Flags

- Do not expand this parent to fix deferred or out-of-cycle audit opportunities
  unless a must-fix resolution directly requires it.
- Do not add new Prescription Notation grammar features while hardening
  validation; unsupported constructs should remain unsupported with better
  diagnostics.
- Do not infer Target Ranges from current Zone configuration. Inline Target
  Ranges remain the authoritative numeric targets for historical comparison.
- Do not make default missing Prescribed Run association fatal. The loud
  behavior is scoped to an explicit `--prescribed-run` override.
- [x] [#74 -> parent] Repetition-count cap (`MAX_REPEAT_COUNT = 50`) and
  comparable-label classification (`NON_COMPARABLE_LABELS = {E, LR, REC}`)
  are documented in ADR 0006. Resolved.
- [x] Pre-declared AAR deferrals for non-must-fix test gaps from the audit's "Test
  coverage gaps (Reliable bar)" list: interleaved arrow types (`A -> B → C`),
  `→` inside a repetition body, leading/trailing whitespace and lone-arrow
  inputs (`"->"`, `"1.6K @ E ->"`), and an explicit
  fixture-without-`prescribed_runs` round-trip test. Resolve at closure with a
  brief rationale rather than expanding sub-issue scope mid-flight. Resolved in
  `aar.md`; accepted as non-must-fix test debt outside the parent #73 closure
  scope.
