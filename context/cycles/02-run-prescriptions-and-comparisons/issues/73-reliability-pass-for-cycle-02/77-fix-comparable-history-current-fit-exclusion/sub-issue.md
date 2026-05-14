# Sub-Issue #77 -- Fix comparable-history current FIT exclusion

Vertical slice for parent #73. Delivers the current-run exclusion fix for
Comparable-History Delta candidate discovery when the current FIT File uses an
uppercase or mixed-case `.FIT` extension.

## Description

Harden history artifact discovery so the current Run's own FIT File is excluded
from prior-candidate discovery regardless of extension case. The CLI already
derives `currentFitBasename` using `path.extname`, which strips `.FIT`; the
history reader must apply the same case-insensitive FIT extension rule when
scanning Block directory entries.

This sub-issue covers only the must-fix audit finding for current FIT exclusion.
It does not change `.yaml` versus `.yml` precedence, directory-vs-file handling,
candidate reason taxonomy, or Comparable-History Delta arithmetic.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| `readHistoryArtifacts` | In-process plus local filesystem | Test through the public reader using temporary directories with `.FIT`, `.fit`, and sibling artifacts. |
| Node `fs/promises.readdir` and `readFile` | Irreplaceable | Use real temporary directories, matching existing history-reader tests, because filesystem casing is the behavior under test. |
| Node `path.basename`/`extname` CLI derivation | In-process | CLI behavior is already correct by audit; add a narrow integration/regression only if needed to prove handoff. |
| YAML/JSON artifact parsing | In-process | Use minimal valid artifacts or existing fixture helpers so parsing does not obscure basename behavior. |
| `vitest` | In-process | Add focused engine history-reader tests. |

No remote-owned, collaborator-owned, or true external dependency is introduced.
No port is required because the existing reader intentionally exercises the real
local filesystem boundary.

## Interface design

The interface this sub-issue commits to is the basename normalization rule inside
history artifact discovery.

### Design-it-twice

**Alternative A -- Normalize FIT extension case in the history reader**

Update `readHistoryArtifacts` discovery to treat `.fit`, `.FIT`, and mixed-case
variants as FIT files, strip the extension case-insensitively, and compare the
candidate basename to `currentFitBasename` with the same basename semantics used
by the CLI.

```ts
function isFitFileName(entry: string): boolean {
  return /\.fit$/i.test(entry);
}

function stripFitExtension(entry: string): string {
  return entry.replace(/\.fit$/i, "");
}
```

- Leverage: high -- all callers of the engine reader get the corrected behavior.
- Locality: high -- discovery owns file filtering and current-run exclusion.
- Testability: high -- a temporary directory can reproduce the exact candidate
  set without involving CLI parsing.

**Alternative B -- Lowercase `currentFitBasename` at the CLI handoff**

Have the CLI pass a lowercased basename to `quantify`, and expect the reader to
compare against lowercased directory-derived names.

- Leverage: low -- engine callers outside the CLI can still pass a basename with
  original casing.
- Locality: low -- current-run exclusion is split between CLI and engine.
- Testability: medium -- tests must coordinate casing choices across layers.

**Alternative C -- Document uppercase `.FIT` as unsupported**

Reject uppercase extensions in CLI validation or record the behavior as a
deferred limitation.

- Leverage: low -- the project already treats `.fit` case-insensitively in other
  seams such as `scanBlockRuns`.
- Locality: medium -- CLI validation would not protect engine reader callers.
- Testability: high but misaligned -- tests would assert a worse user contract.

### Choice

**A (normalize FIT extension case in the history reader).** It fixes the owning
engine seam and aligns history discovery with existing `.fit` case-insensitive
behavior elsewhere in the codebase.

B is rejected in one sentence: CLI-only normalization leaves the engine reader
wrong for non-CLI callers. C is rejected in one sentence: declaring uppercase
`.FIT` unsupported contradicts existing case-insensitive FIT handling and does
not meet the Reliable bar.

### Public interface

Entry point:

```ts
export async function readHistoryArtifacts(
  options: ReadHistoryArtifactsOptions,
): Promise<HistoryArtifactReport>;
```

Inputs:

- `blockDirPath`: Block directory containing FIT files and Analysis Artifacts.
- `currentFitBasename`: current Run basename without FIT extension, preserving
  whatever casing the caller derived.
- `comparisonGroup`: current Run Comparison Group.

Outputs:

- Candidate descriptors for prior FIT basenames only.
- No descriptor for the current Run's basename when the directory entry is
  `current.fit`, `current.FIT`, or any mixed-case extension variant.

Invariants:

- FIT extension detection is case-insensitive.
- Extension stripping is case-insensitive.
- Current-run exclusion happens before artifact pairing and parsing.
- Basename comparison should not require the current FIT extension casing to
  match the on-disk entry extension casing.
- Existing same-basename YAML/JSON ambiguity behavior remains unchanged.

Error modes:

- Missing or unreadable directory still returns `no_candidates`.
- Empty `currentFitBasename` and empty `comparisonGroup` remain programmer
  errors.
- Unparseable prior artifacts remain candidate-level unavailable reasons; the
  current Run's own artifact should not be parsed at all.

## Acceptance criteria

- `readHistoryArtifacts` discovers FIT entries with case-insensitive `.fit`
  extension matching.
- `readHistoryArtifacts` excludes the current Run before artifact parsing when
  the current file is named with `.FIT` or mixed-case extension.
- Regression test proves a current `run-1.FIT` with sibling `run-1.yaml` is not
  returned as a history candidate.
- Regression test proves a different prior `run-2.FIT` or `run-2.fit` can still
  be discovered and classified normally.
- Existing history-reader tests for ambiguity, missing candidates, and
  unavailable artifacts continue to pass.

## Proposed tests

- History reader: temporary directory contains `run-1.FIT` and `run-1.yaml`, with
  `currentFitBasename: "run-1"`; result is `no_candidates` or contains no
  `run-1` candidate.
- History reader: temporary directory contains current `run-1.FIT` and prior
  `run-2.FIT` with valid artifact; result includes only `run-2`.
- History reader: mixed-case `run-3.FiT` is discovered as a prior candidate.
- Regression: lowercase `.fit` behavior remains unchanged.

## Affected artifacts

- `packages/engine/src/plan/history.ts`
- `packages/engine/src/plan/history.test.ts`
- `packages/engine/src/computations/quantify.test.ts` only if an integration
  assertion is needed beyond the reader seam
- `packages/cli/src/commands/quantify.ts` is not expected to change because it
  already uses `basename(args.file, extname(args.file))`

## Dependencies

- Upstream: parent #66 history artifact reader and comparable-history
  integration.
- Independent: sub-issues #74 through #76 can complete before this fix because
  the history-reader seam is isolated.
- Downstream: parent closure uses this regression as evidence that the current
  Run cannot compare against its own Analysis Artifact.
