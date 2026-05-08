# Parent Issue #47 — Public API regrouping

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- `packages/engine/src/index.ts` exports ≤30 names. Verified by counting
  the unique exported identifiers (functions, classes, constants, and
  types each count as one). The current count is roughly 80.
- The top-level section banners in `index.ts` match the four
  `ubiquitous-language.md` groupings in glossary order — Periodization,
  Runs and capture, Metrics and zones, Analysis output — followed by an
  Infrastructure grouping for config loaders, formatter output, and
  case-key helpers. No banner uses an implementation-level term
  ("Public types", "Public functions", "Computation utilities").
- Every remaining export maps to either:
  - a glossary term in `ubiquitous-language.md` (the export's name or
    its primary noun appears in the glossary), **or**
  - an obvious infrastructure concern (config loading, output
    formatting, case-key transforms, runtime version constant).
  Verified by inspection: each export's banner placement is justified by
  one of the two clauses, recorded in the audit manifest produced by
  sub-issue #48.
- Every export removed from the public surface is justified by either
  folding into a deeper API (recorded with the deeper API's name and
  rationale) or being genuinely internal (recorded with confirmation
  that no current consumer in `packages/cli/src/**` imports it).
  Verified by grep against the CLI source tree.
- The CLI continues to function. If an export is renamed or removed,
  `packages/cli/src/**` is updated in the same PR. CLI behaviour is
  byte-identical for `quantify`, `plan create`, `plan status`,
  `plan sync`, and `plan adjust` against existing fixtures. Verified
  by running existing CLI command tests without modification.
- All existing tests pass: `pnpm test` at the workspace root is green.
- The engine package builds (DTS included):
  `pnpm --filter @run2max/engine build` succeeds. Closure-flag check
  carried forward from parent #38.
- TypeScript strict mode stays on. `TS2589` does not regress.
- The cycle PRD's `RESOLVE THROUGH IMPLEMENTATION` open question on the
  final engine export grouping shape is answered. After parent close,
  `context/cycles/01-deepen-engine/prd.md` is updated to mark it
  resolved with a brief description of the chosen grouping. The chosen
  shape is also recorded as ADR 0005 if its rationale is non-obvious
  (per cycle PRD policy on ADRs).

## Implementation approach

This parent is sized for incremental sub-issue decomposition. The first
sub-issue (#48) produces a decision-only deliverable — an export
audit manifest plus the chosen grouping shape — without modifying any
source. Subsequent sub-issues are added lazily based on what the
manifest reveals.

1. **Sub-issue #48 — Audit and grouping design.** Read every public
   export in current `index.ts`. For each, classify as KEEP (with new
   grouping), FOLD (into a deeper API — naming the deeper API and
   recording why the shallow export is no longer needed), or HIDE
   (genuinely internal — recording confirmation that no CLI or
   external consumer imports it). Design-it-twice the grouping shape:
   four-domain-plus-infrastructure (preferred per the cycle PRD's
   encounter statement) versus alternatives (e.g. consumer-led
   ordering). Output: a manifest committed to this issue folder. No
   source changes.
2. **Sub-issue #49 (lazy) — Apply the manifest.** Created only if
   sub-issue #48's manifest is mechanically applicable in one PR. The
   sub-issue rewrites `index.ts` per the manifest, updates CLI imports
   for any renamed or removed exports, runs the verification suite,
   and confirms the count and grouping criteria.
3. **Sub-issue #50+ (lazy) — Folding work.** Created only if the
   audit reveals one or more shallow exports that should fold into a
   deeper API rather than just disappear. Each such fold is its own
   API design (e.g. if `loadPlan + loadUserTemplates +
   resolveTemplate` should fold into a single `resolvePlan`
   high-level API, that is API design work, not grouping work, and
   gets its own sub-issue).

The decomposition is incremental: only sub-issue #48 is created at
parent open. Subsequent sub-issues are created after #48's manifest
lands and the parent has a basis for sizing the remaining work.

## Dependencies

- Upstream: parent #32 (closed) — named Plan-family interfaces are
  stable; they appear under Periodization in the new grouping.
- Upstream: parent #35 (closed) — `walkPlan` and `WeekContext` are
  stable; they appear under Periodization.
- Upstream: parent #38 (closed) — `aggregateBucket` and its types are
  stable; they appear under Analysis output.
- Upstream: parent #41 (closed) — formatters re-located to
  `formatters/plan.ts`; their grouping is decided here.
- Upstream: parent #44 (closed) — `addDays` and the
  `transformKeysSnakeToCamel` / `transformKeysCamelToSnake` helpers
  landed on the public surface to support CLI consumption; their
  banner placement (Infrastructure vs. inline-in-CLI) is decided
  here.
- Tooling: `pnpm test` plus `pnpm --filter @run2max/engine build`
  for repository-runnable verification, and grep against
  `packages/cli/src/**` to confirm no consumer breaks when an export
  is hidden.
- External: `valibot` untouched. `vitest` continues to drive tests.

## Flags

- This parent is the cycle's last parent. Cycle close follows once
  this parent's AAR lands. After cycle close, the engine's public
  surface is stable for the next feature cycle.
- The cycle PRD's success metric on engine public-export count
  (≤30, from 50+) is owned here. If the audit in sub-issue #48
  cannot reach ≤30 without folding work that would expand the
  parent's scope significantly, the metric is renegotiated in the
  AAR rather than violated silently. The renegotiation is recorded
  with reasoning, not done by adjusting the metric to fit the
  current count.
- The cycle PRD's encounter statement on top-level grouping (matching
  `ubiquitous-language.md`) is the binding constraint. If the
  design-it-twice surfaces a grouping that scores higher on
  consumer ergonomics but does not match the glossary, the glossary
  match wins — the encounter statement is a hard constraint, not a
  preference.
- If the audit reveals an export that is consumed by the CLI but
  whose name does not match any glossary term, the export is either
  renamed during this parent (with the CLI updated in the same PR)
  or kept under Infrastructure with a one-line note explaining why
  it has no domain home. Renames are preferred where the rename
  improves the call site.
- The deletion test from parent #41 (deleting
  `formatters/plan.ts` leaves the logic layer type-checking) is a
  property of the seam, not of the public surface. This parent does
  not weaken that property — `formatters/plan.ts` is still
  re-exported from `index.ts` after this parent, just under a
  different banner.
- Once this parent closes, re-introducing an
  implementation-grouped banner ("Public types", "Public functions",
  "Computation utilities") in `index.ts` is a drift signal — flag
  it. The new banners are domain-led; new exports go under their
  domain home, not under a fresh implementation banner.
- ADR 0005 is written at parent close if the chosen grouping carries
  non-obvious rationale (e.g. why Plan presentation lives under
  Periodization rather than Infrastructure, or why a particular
  shallow export was kept rather than folded). Otherwise the AAR is
  sufficient.

- [ ] [48-audit-and-grouping-design -> 49-apply-manifest]

  Sub-issue #48 landed the full export manifest (KEEP 29 / FOLD 5 / HIDE 65)
  and chose the glossary-aligned grouping shape. The apply sub-issue must
  rewrite `packages/engine/src/index.ts` to exactly match the manifest and
  update CLI imports in the same PR where classifications require it.

  Files to review:
  - context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/sub-issue.md
  - context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md

  (See source AAR for full context)

- [ ] [48-audit-and-grouping-design -> 50-template-api-fold]

  The audit classified `loadUserTemplates`, `resolveTemplate`, and
  `BUILTIN_TEMPLATES` as FOLD, with a deeper intent-level template access
  surface proposed. If parent #47 keeps fold work in-scope, create and execute
  this fold as a dedicated sub-issue instead of mixing it into mechanical
  regrouping.

  Files to review:
  - context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md

  (See source AAR for full context)

- [ ] [48-audit-and-grouping-design -> 51-plan-status-formatter-fold]

  The audit classified `formatDefaultView` and `formatFullView` as FOLD toward
  a single view-parameterized formatter API. This needs explicit API design and
  migration planning; treat it as its own sub-issue if adopted.

  Files to review:
  - context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md

  (See source AAR for full context)
