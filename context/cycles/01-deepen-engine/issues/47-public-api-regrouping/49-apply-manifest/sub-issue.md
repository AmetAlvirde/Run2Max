# Sub-Issue #49 — Apply manifest

## Description

Mechanically rewrite `packages/engine/src/index.ts` to match the
manifest produced by sub-issue #48
(`context/cycles/01-deepen-engine/issues/47-public-api-regrouping/48-audit-and-grouping-design/manifest.md`).
The manifest is the input; this sub-issue is its output.

Specifically: place the 29 KEEP exports under their target banners
(Periodization, Runs and capture, Metrics and zones, Analysis output,
Infrastructure) in glossary order, remove the 65 HIDE exports from
the public surface, and leave the 5 FOLD exports in place under their
current source modules until sub-issues #50 (template API fold) and
#51 (plan-status formatter fold) land their replacement APIs.

After this sub-issue closes, `index.ts` exports 34 names (29 KEEP +
5 FOLD-pending). The ≤30 target is met only once #50 and #51
complete; that completion is parent #47's overall closure criterion,
not this sub-issue's.

This sub-issue does not design any new API. It does not introduce
`formatPlanStatus`, `resolvePlanTemplate`, or `listPlanTemplates`.
It does not remove `formatDefaultView`, `formatFullView`,
`loadUserTemplates`, `resolveTemplate`, or `BUILTIN_TEMPLATES`. Each
of those is owned by its respective fold sub-issue.

## Dependency classification

**In-process.** The only inputs are local files
(`manifest.md`, `index.ts`, `packages/cli/src/**`); the only outputs
are an edited `index.ts` and the existing test/build verification
suites. No external services, no port/adapter, no mock surface.

The manifest's HIDE rationale was already grep-verified against
`packages/cli/src/**` during sub-issue #48. This sub-issue
re-verifies before deletion as a closure check, but the underlying
classification is not in question.

## Interface design

### Input

`manifest.md` Section 2 (audit table) and Section 1 (chosen
grouping shape). Treat both as canonical. If a row's classification
or banner placement appears wrong during implementation, **stop and
flag** rather than diverging — the manifest is the contract.

### Output

A rewritten `packages/engine/src/index.ts` whose structure is:

```
ENGINE_VERSION constant

// Periodization banner
  19 KEEP exports + (until #50/#51 land) FOLD-pending plan-related exports

// Runs and capture banner
  1 KEEP export

// Metrics and zones banner
  (empty — manifest places no KEEP rows here; banner present per chosen shape, with a comment noting why)

// Analysis output banner
  3 KEEP exports + (until #51 lands) FOLD-pending formatter exports

// Infrastructure banner
  6 KEEP exports
```

The empty Metrics-and-zones banner stays as a structural
placeholder. The cycle PRD's encounter statement requires top-level
groupings to match `ubiquitous-language.md`; dropping a banner
because it has no current export would silently violate that
contract and create a drift signal at the next addition.

A short comment under the Metrics-and-zones banner records this
explicitly so future maintainers do not re-flatten it. Example:

```typescript
// ---------------------------------------------------------------------------
// Metrics and zones
// ---------------------------------------------------------------------------
// (No public exports today — Zone, CP, eFTP, LTHR, NP, IF, RSS are
// glossary terms operated on by Analysis output APIs. Banner is kept
// to preserve the four-domain-plus-Infrastructure structure required
// by the cycle PRD encounter statement.)
```

### Design-it-twice on apply approach

- **Alternative A — Fresh rewrite.** Write a new `index.ts` from
  scratch using the manifest as the source of truth. Old file is
  fully replaced. Banner comments, ordering, and grouping match
  the manifest exactly with no carry-over of the legacy structure.
- **Alternative B — Incremental edit.** Edit the existing file in
  place: rename banners, move exports between banners, delete HIDE
  exports last. Preserves git blame on individual export lines.

**Chosen: A.** The file is ~110 lines and the manifest's grouping
diverges from the current structure on every banner. A fresh
rewrite is mechanically simpler and the resulting diff is
unambiguous — every line either appears in the manifest or doesn't.
Incremental editing risks partial states where exports have moved
banners but the banner comments have not, which is exactly the
implementation-grouped-banner drift signal the parent flags.
**Rejection of B**: blame preservation for export lines in a
re-export-only file is low value; the source modules retain their
own blame.

### Verification gates

The sub-issue closes only when:

1. The new `index.ts` contains exactly the 29 KEEP exports under
   their manifest-specified banners, in the manifest's order.
2. The new `index.ts` contains the 5 FOLD-pending exports
   (`formatDefaultView`, `formatFullView`, `loadUserTemplates`,
   `resolveTemplate`, `BUILTIN_TEMPLATES`) in their current
   target banners pending fold sub-issues. Each is annotated with
   a one-line `// TODO(sub-issue #50)` or `// TODO(sub-issue #51)`
   comment so the fold sub-issues' authors find them.
3. `index.ts` contains zero of the 65 HIDE-classified exports.
   Verified by grep per HIDE name against `index.ts`.
4. `pnpm test` at the workspace root: green, no test files
   modified.
5. `pnpm --filter @run2max/engine build`: green (DTS included).
   Closure-flag from parent #38.
6. `tsc --noEmit` (or whatever the workspace uses) clean — no
   `TS2589`, no strict-mode regression.
7. CLI behaviour byte-identical: `run2max quantify`,
   `run2max plan create`, `run2max plan status`,
   `run2max plan status --full`, `run2max plan sync`,
   `run2max plan adjust` all produce unchanged output for
   existing fixtures. Verified by running existing CLI command
   tests without modification.
8. No CLI source file is modified by this sub-issue. The manifest's
   consumer index confirms every CLI-imported export is KEEP or
   FOLD; no HIDE is CLI-consumed. If implementation reveals a
   counter-example (CLI imports a HIDE name), **stop and flag** —
   the manifest needs revision before this sub-issue can complete.

## Acceptance criteria

- `packages/engine/src/index.ts` matches the manifest's KEEP+FOLD
  set exactly. Verified by line-by-line comparison of exported
  names against `manifest.md` Section 2.
- The five top-level banners appear in glossary order:
  Periodization, Runs and capture, Metrics and zones, Analysis
  output, Infrastructure. No implementation-grouped banner names
  ("Public types", "Public functions", "Computation utilities",
  "quantify", "Formatters", "Plan schema, types, and validation",
  "Plan templates") survive.
- Each FOLD-pending export carries a `// TODO(sub-issue #50)` or
  `// TODO(sub-issue #51)` comment naming the fold target's
  intended replacement (`formatPlanStatus`, `resolvePlanTemplate`,
  `listPlanTemplates`).
- `grep -F` per HIDE name returns zero matches in
  `packages/engine/src/index.ts`. Verified for all 65 HIDE rows.
- `pnpm test` green. No test file modified.
- `pnpm --filter @run2max/engine build` green. DTS included.
- TypeScript strict mode unchanged. `TS2589` does not regress.
- No file in `packages/cli/src/**` is modified by this sub-issue.
- The export count in `index.ts` is exactly 34 (29 KEEP + 5 FOLD-
  pending). The ≤30 target is explicitly **not** met by this
  sub-issue; it is parent #47's overall criterion, satisfied
  after #50 and #51 land.

## Proposed tests

No new tests. The existing test suites verify behaviour preservation:

- Engine package unit/integration tests (`packages/engine/**/*.test.ts`)
  exercise the implementation modules directly — they do not import
  via `@run2max/engine` per the sub-issue #48 audit, so removing a
  HIDE export from the public surface does not affect them.
- CLI command tests (`packages/cli/test/commands/**`) exercise
  every public-surface consumer; they pass without modification if
  the apply is correct.
- The DTS build verifies the public surface compiles.

Adding tests for "the public surface contains exactly these names"
would test the manifest, not the system. Manifest fidelity is
verified by the grep checks listed under acceptance criteria.

## Affected artifacts

**Modified**:

- `packages/engine/src/index.ts` — full rewrite per the manifest.

**Not modified** (despite passing through the verification suite):

- `packages/cli/src/**` — manifest's consumer index confirms no
  HIDE-classified export is CLI-consumed. If the apply causes any
  CLI compilation error, the manifest is wrong and the sub-issue
  stops.
- `packages/engine/src/**/*.test.ts` — engine tests use relative
  imports, not the package entrypoint.
- Source modules under `packages/engine/src/{plan,computations,formatters,config}/**`
  — their internal `export` keywords stay; only the re-export from
  `index.ts` is removed. HIDE-classified internals remain
  importable by relative path within the engine package.

**Created**: none.
**Deleted**: none.

## Dependencies

- Upstream: sub-issue #48 (closed) — produced the manifest this
  sub-issue applies. The manifest is the contract; divergence
  triggers a stop-and-flag, not a unilateral change.
- Sibling: sub-issue #50 (template API fold) and sub-issue #51
  (plan-status formatter fold) — own the FOLD rows that this
  sub-issue leaves in place. Ordering between #49 and #50/#51
  is independent; #49 does not block them and they do not block
  it. Parent #47 closes once all three have landed.
- Tooling: `pnpm test`, `pnpm --filter @run2max/engine build`,
  grep against `index.ts` and `packages/cli/src/**`.
- No external dependencies. No network. No filesystem state
  beyond the rewritten `index.ts`.
