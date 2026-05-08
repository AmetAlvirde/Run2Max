# Sub-Issue #50 — Template API fold

## Description

Replace the three template-related public exports
(`loadUserTemplates`, `resolveTemplate`, `BUILTIN_TEMPLATES`) with two
intent-level functions on the engine's public surface:

- `resolvePlanTemplate(name, { userTemplatesDir? })` — given a template
  name, returns the matching `PlanTemplate` (user template wins over
  builtin of the same name), or `undefined` if no template with that
  name exists in either source.
- `listPlanTemplates({ userTemplatesDir? })` — returns the effective
  catalog (user templates first, then builtins) for UX listing and
  unknown-template diagnostics.

Both go under the **Periodization** banner in `index.ts`. After this
sub-issue lands, the three FOLD-classified exports are removed from
the public surface; the underlying source modules retain their
internals so existing engine-package tests (which import via relative
paths) continue to pass without modification.

This sub-issue does not redesign `buildPlanFromTemplate`,
`reconcile`, or any other Plan-construction API. It does not touch
the formatter fold (sub-issue #51). It does not change CLI behavior
for `run2max plan create`; the same template names resolve to the
same `PlanTemplate` objects, the same unknown-template error message
is emitted, and the same exit codes apply.

After this sub-issue closes, `index.ts` exports 33 names (29 KEEP +
2 new template API + 2 FOLD-pending formatter exports). The ≤30
target is still pending sub-issue #51.

## Dependency classification

**In-process.** Inputs are the engine source tree
(`plan/loader.ts`, `plan/templates/builtin.ts`,
`plan/templates/types.ts`), the CLI consumer
(`packages/cli/src/commands/plan/create.ts`), and the existing test
suite. Outputs are edited engine source, edited CLI source, and the
existing verification suites. No external services, no port/adapter,
no mock surface.

User-templates loading touches the filesystem (reads a directory of
YAML files). That dependency is already in-process via
`node:fs/promises` in the current `loadUserTemplates` and is not
re-classified by this fold — the function is moved/wrapped, not
re-architected.

## Interface design

### Inputs

- Manifest row for `loadUserTemplates`, `resolveTemplate`, and
  `BUILTIN_TEMPLATES` (Section 2 of `manifest.md`) and the manifest's
  fold-target rationale (centralize builtin+user lookup, return
  effective catalog).
- Current `packages/engine/src/plan/loader.ts` (lines 44–74) and
  `packages/engine/src/plan/templates/builtin.ts` for the existing
  semantics being preserved.
- Current `packages/cli/src/commands/plan/create.ts` for the call
  pattern that must continue to work byte-identically.

### Output

Two new public functions on `@run2max/engine`, plus updated CLI
imports. Banner placement under **Periodization** in `index.ts`.

### Design-it-twice on the resolve API shape

- **Alternative A — Minimal: `T | undefined` return.**
  `resolvePlanTemplate(name, { userTemplatesDir? }): Promise<PlanTemplate | undefined>`.
  CLI calls `listPlanTemplates` separately on the unknown-template
  error path to render available names. Two filesystem reads on the
  error path (negligible for a CLI command). Mirrors the existing
  `resolveTemplate` and `getBuiltinTemplate` `T | undefined` idiom.

- **Alternative B — Discriminated-union envelope.**
  Returns `{ kind: "ok"; template } | { kind: "unknown"; requested; available }`.
  CLI handles both branches in a single call, no second filesystem
  read on error. Mirrors the existing `reconcile` discriminant
  pattern. Costs a new exported result type and slight overlap
  between the `unknown` payload and `listPlanTemplates`.

- **Alternative C — Throws on miss with structured error.**
  `resolvePlanTemplate(...)` returns `Promise<PlanTemplate>`, throws
  `UnknownPlanTemplateError` carrying `available`. Pushes consumers
  into try/catch as control flow.

**Chosen: A.** The existing `T | undefined` idiom is already used for
`getBuiltinTemplate` and `resolveTemplate`; preserving it minimizes
semantic churn for an unchanged behavior. The duplicate readdir on
the error path is negligible (CLI runs once per invocation, error
path is uncommon, the dir is small or absent). A keeps the new
public surface to two plain functions with no new exported types.
**Rejection of B**: the discriminant envelope's value (saving one
readdir on the error path, bundling `available` into the resolve
return) does not justify a new exported result-type shape that
duplicates `listPlanTemplates`'s purpose. **Rejection of C**:
throws-as-control-flow is not the engine's convention here
(`reconcile` returns discriminants, `validatePlan` returns
diagnostics, lookups return `T | undefined`); a new error class
expands the public surface for no behavior gain.

### Design-it-twice on `userTemplatesDir`

- **Required option.** `resolvePlanTemplate(name, { userTemplatesDir })`,
  no default. CLI always passes the dir; tests pass a fixture dir or
  a guaranteed-absent path.
- **Optional option.** Omitting `userTemplatesDir` skips user-template
  loading and considers builtins only. CLI always passes the dir;
  tests can call `resolvePlanTemplate("1-meso")` without options.

**Chosen: optional.** Tests in `plan/templates/` already exercise
builtin resolution against an empty user-templates list; making the
option optional preserves that ergonomics for future tests and
documentation examples without forcing a fake path. CLI behavior is
unchanged because the CLI always passes the dir. **Rejection**: the
required-option variant adds friction for builtin-only callers
without a corresponding correctness gain.

### Final signatures

```typescript
async function resolvePlanTemplate(
  name: string,
  options?: { userTemplatesDir?: string }
): Promise<PlanTemplate | undefined>;

async function listPlanTemplates(
  options?: { userTemplatesDir?: string }
): Promise<PlanTemplate[]>;
```

Semantics:

- `resolvePlanTemplate("1-meso")` → returns the builtin `1-meso` template.
- `resolvePlanTemplate("custom", { userTemplatesDir })` → returns the
  user template named `custom` if present in `userTemplatesDir`, else
  the builtin if one exists with that name, else `undefined`.
- `resolvePlanTemplate("custom")` (no dir) → builtins only; returns
  `undefined` for any non-builtin name.
- `listPlanTemplates({ userTemplatesDir })` → returns
  `[...userTemplates, ...BUILTIN_TEMPLATES]` (user-first, dedup not
  required — name collision has user winning at resolve, both names
  appearing in the listing is intentional and matches today's
  CLI error message).
- `listPlanTemplates()` (no dir) → returns `[...BUILTIN_TEMPLATES]`.
- Missing or non-existent `userTemplatesDir` is not an error;
  user-template loading silently yields an empty list (today's
  `loadUserTemplates` ENOENT behavior is preserved).

Invariants:

- Both functions are pure with respect to their inputs aside from
  the readdir/readFile operations on `userTemplatesDir`.
- Neither function mutates `BUILTIN_TEMPLATES` or any returned
  `PlanTemplate`.
- `PlanTemplate` itself is unchanged; this fold does not redesign
  the template type.

Error modes:

- `userTemplatesDir` exists but contains malformed YAML: the
  underlying `loadUserTemplates` already throws the YAML error
  through; preserved unchanged.
- `userTemplatesDir` exists but a YAML file lacks a string `name`
  field: silently skipped (today's behavior; preserved).

### Source layout

The two new functions live in a new file
`packages/engine/src/plan/templates/lookup.ts`. This module imports
`loadUserTemplates` from `../loader.js` and `BUILTIN_TEMPLATES` from
`./builtin.js` and composes them into the two public functions.

**Why a new module rather than adding to `loader.ts`:** `loader.ts`
today mixes Plan loading (`loadPlan`) with user-template loading
(`loadUserTemplates`); adding the resolve/list functions there would
deepen that mixing. A dedicated `templates/lookup.ts` keeps the
templates API in the templates folder, matches the manifest's
banner-organized intent, and leaves a clean seam for any future
template-source changes (e.g. an HTTP-fetched templates registry).

**Why not move `loadUserTemplates` out of `loader.ts`:** doing so
would force changes in `plan/loader.test.ts`, which imports
`loadUserTemplates` by relative path. That is unrelated test churn;
the manifest's HIDE classification only affects the public surface
(`index.ts`), not internal layout. `loadUserTemplates` remains
exported from `loader.ts` (still importable by relative path
within the engine package), but is not re-exported from `index.ts`.

### Verification gates

The sub-issue closes only when:

1. `packages/engine/src/index.ts` exports `resolvePlanTemplate` and
   `listPlanTemplates` under the **Periodization** banner.
2. `packages/engine/src/index.ts` no longer exports
   `loadUserTemplates`, `resolveTemplate`, or `BUILTIN_TEMPLATES`.
   The `// TODO(sub-issue #50)` markers placed by sub-issue #49 are
   removed along with the lines they annotate.
3. `packages/cli/src/commands/plan/create.ts` imports
   `resolvePlanTemplate` and `listPlanTemplates` from
   `@run2max/engine`. It does not import `loadUserTemplates`,
   `resolveTemplate`, or `BUILTIN_TEMPLATES`.
4. `run2max plan create --template <name> --block <b> --start <d>`
   produces byte-identical stdout/stderr for both happy-path
   (template found) and error-path (unknown template) for every
   existing CLI fixture. Verified by running existing CLI command
   tests without modification.
5. `pnpm test` at the workspace root: green. Engine-package tests
   in `plan/loader.test.ts` and `plan/templates/builtin.test.ts`
   pass without modification (they import via relative paths).
6. `pnpm --filter @run2max/engine build`: green (DTS included).
   Closure-flag from parent #38.
7. `tsc --noEmit` clean — no `TS2589`, no strict-mode regression.
8. The export count in `index.ts` is exactly 33 (29 KEEP + 2 new
   template API + 2 FOLD-pending formatter exports). The ≤30 target
   is still pending sub-issue #51 and is parent #47's overall
   criterion.

## Acceptance criteria

- `packages/engine/src/plan/templates/lookup.ts` exists and exports
  `resolvePlanTemplate` and `listPlanTemplates` with the signatures
  in the **Final signatures** section.
- `packages/engine/src/index.ts` re-exports
  `resolvePlanTemplate` and `listPlanTemplates` under the
  **Periodization** banner; does not re-export `loadUserTemplates`,
  `resolveTemplate`, or `BUILTIN_TEMPLATES`.
- `grep -F` for `loadUserTemplates`, `resolveTemplate`, and
  `BUILTIN_TEMPLATES` in `packages/engine/src/index.ts` returns zero
  matches.
- `grep -F` for `loadUserTemplates`, `resolveTemplate`, or
  `BUILTIN_TEMPLATES` in `packages/cli/src/**` returns zero matches.
- `packages/cli/src/commands/plan/create.ts` happy-path and
  error-path output are byte-identical to pre-fold output for every
  existing fixture. Specifically: the unknown-template error message
  formats as `error: unknown template "<name>". Available: <comma-separated list>`,
  with the same name ordering (user templates first, then builtins).
- `pnpm test` green. No test file modified.
- `pnpm --filter @run2max/engine build` green. DTS included.
- TypeScript strict mode unchanged. `TS2589` does not regress.
- The export count in `index.ts` is exactly 33.
- The internals (`loadUserTemplates` in `loader.ts`,
  `BUILTIN_TEMPLATES` and `getBuiltinTemplate` in
  `templates/builtin.ts`, `resolveTemplate` in `loader.ts`) remain
  exported from their source modules and importable by relative
  path within the engine package.

## Proposed tests

Two new test files; existing tests remain unmodified.

- `packages/engine/src/plan/templates/lookup.test.ts` — exercises
  `resolvePlanTemplate` and `listPlanTemplates` directly. Cases:
  - `resolvePlanTemplate("1-meso")` returns the builtin (no dir).
  - `resolvePlanTemplate("nonexistent")` returns `undefined`.
  - `resolvePlanTemplate("1-meso", { userTemplatesDir })` returns
    the user template when a same-named user template exists
    (user-wins).
  - `resolvePlanTemplate("custom", { userTemplatesDir })` returns
    the user template when only a user template has that name.
  - `resolvePlanTemplate("missing", { userTemplatesDir })` returns
    `undefined` when neither source has the name.
  - `resolvePlanTemplate("1-meso", { userTemplatesDir: "/no/such/dir" })`
    falls through to builtin without error.
  - `listPlanTemplates()` returns the five builtins in builtin
    order.
  - `listPlanTemplates({ userTemplatesDir })` returns user
    templates first, then builtins.
  - `listPlanTemplates({ userTemplatesDir: "/no/such/dir" })`
    returns the five builtins.

  These tests use real fixture directories (created via `mkdtemp`),
  consistent with the existing `loader.test.ts` style. No mocks.

- No new CLI tests required: the existing `packages/cli/test/commands/plan/create.*`
  fixtures exercise both happy-path and unknown-template paths;
  byte-identical output is the closure check.

The existing `plan/loader.test.ts` (which tests `loadUserTemplates`
and `resolveTemplate` directly via relative imports) remains
unchanged — those internals are kept as in-package implementation
detail and the tests document their semantics.

## Affected artifacts

**Created**:

- `packages/engine/src/plan/templates/lookup.ts` — new module with
  `resolvePlanTemplate` and `listPlanTemplates`.
- `packages/engine/src/plan/templates/lookup.test.ts` — unit tests
  for the new module.

**Modified**:

- `packages/engine/src/index.ts` — adds the two new exports under
  the Periodization banner; removes `loadUserTemplates`,
  `resolveTemplate`, `BUILTIN_TEMPLATES`, and their `// TODO(sub-issue #50)`
  markers.
- `packages/cli/src/commands/plan/create.ts` — replaces the
  `loadUserTemplates` + `resolveTemplate` two-step with a single
  `resolvePlanTemplate` call; replaces the `BUILTIN_TEMPLATES`
  reference in the error path with `listPlanTemplates`.

**Not modified**:

- `packages/engine/src/plan/loader.ts` — `loadUserTemplates` and
  `resolveTemplate` stay exported (internally) so
  `plan/loader.test.ts` keeps passing without changes.
- `packages/engine/src/plan/templates/builtin.ts` —
  `BUILTIN_TEMPLATES` and `getBuiltinTemplate` remain exported so
  `plan/templates/builtin.test.ts`, `plan/build.test.ts`, and
  `plan/reconcile.test.ts` keep passing without changes.
- `packages/engine/src/plan/templates/types.ts` — `PlanTemplate`
  type is unchanged; still exported from `index.ts` per the manifest.
- All other CLI commands — only `plan/create.ts` consumes the three
  folded exports per the manifest's consumer index.

**Deleted**: none. The folded exports remain as in-package internals;
only their re-exports from `index.ts` are removed.

## Dependencies

- Upstream: sub-issue #48 (closed) — manifest specifies the fold
  targets and the deeper API names.
- Upstream: sub-issue #49 (must close first) — places the
  `// TODO(sub-issue #50)` markers in `index.ts` that this sub-issue
  removes; establishes the banner structure under which the new
  exports are placed.
- Sibling: sub-issue #51 (plan-status formatter fold) — independent;
  may land before or after #50. Parent #47 closes once both #50 and
  #51 land along with parent-level closure work.
- Tooling: `pnpm test`, `pnpm --filter @run2max/engine build`, grep
  against `packages/engine/src/index.ts` and `packages/cli/src/**`,
  existing CLI command-test fixtures for byte-identical output
  verification.
- No external dependencies. No network. Filesystem touched only by
  `loadUserTemplates`'s readdir/readFile (unchanged behavior).
