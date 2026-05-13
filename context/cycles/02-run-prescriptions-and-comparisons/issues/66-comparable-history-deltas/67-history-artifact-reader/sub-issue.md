# Sub-Issue #67 -- History Artifact Reader

Vertical slice for parent #66. Delivers the pure engine reader that discovers,
parses, normalizes, filters, and classifies prior detailed Analysis Artifacts
in a Block directory so later sub-issues can compute Comparable-History
Deltas. No delta computation, no `quantify` integration, and no formatter
changes happen in this sub-issue.

## Description

Add a pure engine function that scans a Block directory for prior detailed
Analysis Artifacts, pairs each candidate YAML/JSON file to a sibling FIT File
by basename, normalizes key casing so YAML and JSON share one internal shape,
filters candidates by Comparison Group, excludes the current Run's FIT
basename, and returns structured descriptors that say whether each prior
artifact is eligible for Comparable-History Delta computation or, if not,
the labeled reason.

The reader is the seam where the parent's two MUST-RESOLVE flags get
concrete answers in code: same-basename YAML/JSON precedence and
Detailed-Profile eligibility. Both are settled in this sub-issue's interface
design and asserted directly by its tests.

Out of scope: delta computation, `quantify` integration, attaching results
to `AnalysisResult`, Markdown/JSON/YAML rendering, CLI flags, Plan schema
changes, new config fields, persistence layers, and any change to existing
Prescribed Run association, Prescription Comparison, or Output Profile
behavior.

## Dependency classification

| Dependency | Category | Testing strategy |
| --- | --- | --- |
| Node `fs/promises` (`readdir`, `readFile`) | Irreplaceable | Reader takes a directory path and reads files; tests use real fixture directories under `packages/engine/src/plan/__fixtures__/history/` (or similar) so the filesystem boundary is exercised directly without a port. |
| YAML parsing (`yaml` package, already a transitive dep) | In-process | Reader parses fixture YAML files and asserts normalized output. |
| JSON parsing (`JSON.parse`) | In-process | Reader parses fixture JSON files and asserts normalized output. |
| `transformKeysCamelToSnake` and inverse normalization | In-process | Reuse the existing helper; reader normalizes YAML snake_case to camelCase before eligibility checks so YAML and JSON descriptors are interchangeable. |
| `PrescribedRunContext.comparisonGroup` shape | In-process | Tests pass a literal `comparisonGroup` string; no Plan parsing is required. |
| `PrescriptionComparisonRunActuals` shape from parent #60 | In-process | Reader returns parsed actuals shaped to match this type so delta computation has a single, stable input contract. |
| Block-directory scanning convention from `scanBlockRuns` | In-process | Reader uses the same directory model; reader tests do not call `scanBlockRuns` to avoid coupling to FIT parsing. |

No local-substitutable, remote-owned, collaborator-owned, or true external
dependency is introduced. The filesystem is the only irreplaceable boundary
and is exercised directly through fixture directories, which matches the
existing test style for `scanBlockRuns` and `loadPlan`.

No port is needed. Adding a `HistoryArtifactSource` port would require a
second adapter (e.g. an in-memory map) to justify itself, and the existing
fixture-directory approach already gives fast, deterministic tests.

## Interface design

The interface this sub-issue commits to is the public engine reader entry
point and the structured per-candidate descriptor it returns.

### Design-it-twice

**Alternative A -- Minimal eager reader returning descriptors**

A single function reads the directory once, parses every candidate file
eagerly, applies all filters, and returns a structured array of descriptors
plus a top-level reason when zero descriptors are eligible.

```ts
export interface ReadHistoryArtifactsOptions {
  blockDirPath: string;
  currentFitBasename: string;
  comparisonGroup: string;
}

export type HistoryArtifactDescriptor =
  | HistoryArtifactEligible
  | HistoryArtifactUnavailable;

export interface HistoryArtifactEligible {
  status: "eligible";
  sourcePath: string;
  format: "yaml" | "json";
  fitBasename: string;
  capturedDate: string;
  comparisonGroup: string;
  actual: PrescriptionComparisonRunActuals;
}

export interface HistoryArtifactUnavailable {
  status: "unavailable";
  sourcePath: string;
  format: "yaml" | "json" | "unknown";
  fitBasename: string;
  reason:
    | "unparseable_artifact"
    | "partial_artifact"
    | "comparison_group_mismatch"
    | "ambiguous_artifact"
    | "no_paired_fit";
  missingFields?: ReadonlyArray<HistoryRequiredField>;
  parseError?: string;
}

export type HistoryRequiredField =
  | "avgPower"
  | "avgHeartRate"
  | "maxHeartRate"
  | "avgPace"
  | "rpe"
  | "comparisonGroup"
  | "capturedDate";

export interface HistoryArtifactReport {
  candidates: ReadonlyArray<HistoryArtifactDescriptor>;
  topLevelReason?:
    | "no_candidates"
    | "all_candidates_unavailable";
}

export async function readHistoryArtifacts(
  options: ReadHistoryArtifactsOptions,
): Promise<HistoryArtifactReport>;
```

- Leverage: high -- one call returns everything the delta helper needs and
  everything the formatter needs for unavailable reasons.
- Locality: high -- all directory I/O, parsing, normalization, and filtering
  live in one module behind one public entry point.
- Testability: high -- fixture directories drive the full surface; no
  fixtures need to be hidden behind a port.

**Alternative B -- Layered reader: discover, parse, classify**

Three exported functions: one returns raw paired YAML/JSON file pairs from
the directory, one parses and normalizes a single file path into a typed
record, one applies eligibility and Comparison Group filtering to a parsed
record.

```ts
export function discoverHistoryArtifacts(blockDirPath: string, options: { currentFitBasename: string }): Promise<HistoryArtifactPair[]>;
export function parseHistoryArtifact(filePath: string): Promise<ParsedHistoryArtifact>;
export function classifyHistoryArtifact(parsed: ParsedHistoryArtifact, options: { comparisonGroup: string }): HistoryArtifactDescriptor;
```

- Leverage: medium -- each piece is reusable, but no caller in this cycle
  needs the intermediate seams; downstream sub-issues call the reader once.
- Locality: lower -- the same-basename ambiguity rule and the eligibility
  rule are split across two functions, which complicates the parent's
  MUST-RESOLVE flags.
- Testability: medium -- more units to test, but the integration that
  matters (directory in, descriptors out) still needs a top-level test.

**Alternative C -- Lazy iterator with async generator**

The reader returns an `AsyncIterable<HistoryArtifactDescriptor>` so callers
can short-circuit. A separate helper materializes the iterable into a report
when needed.

```ts
export function iterateHistoryArtifacts(options: ReadHistoryArtifactsOptions): AsyncIterable<HistoryArtifactDescriptor>;
```

- Leverage: low -- no caller in this cycle benefits from short-circuiting;
  Block directories are small (one week's worth of `.fit` files).
- Locality: lower -- consumers must either iterate or call a materializer,
  which is two seams to maintain.
- Testability: medium -- async iterator assertions read worse than plain
  array assertions for a sub-issue whose primary risk is incorrect
  classification, not throughput.

### Choice

**A (minimal eager reader returning descriptors).** It exposes one stable
entry point that downstream sub-issues consume once per `quantify` run,
records same-basename ambiguity and Detailed-Profile eligibility in one
place, and keeps tests focused on the "directory in, descriptors out"
behavior the parent's acceptance criteria assert.

B is rejected in one sentence: splitting discover/parse/classify spreads the
MUST-RESOLVE flags across multiple functions without earning a second
caller. C is rejected in one sentence: lazy iteration has no caller demand
and complicates assertions for the parent's labeled-reason behavior.

### Public interface

Entry point:

```ts
export async function readHistoryArtifacts(
  options: ReadHistoryArtifactsOptions,
): Promise<HistoryArtifactReport>;
```

Inputs:

- `blockDirPath`: absolute or working-directory-relative path to the Block
  folder. The same directory `quantify` already scans for sibling `.fit`
  files via `scanBlockRuns`.
- `currentFitBasename`: the captured Run's FIT basename without the `.fit`
  extension. Used to exclude the current Run's own Analysis Artifact from
  the candidate set.
- `comparisonGroup`: the current Run's Comparison Group. Required; callers
  must not invoke the reader when no Comparison Group is present.

Outputs:

- `candidates`: an array of `HistoryArtifactDescriptor`. Each candidate
  corresponds to one prior basename in the directory. `status: "eligible"`
  carries the structured prior-actuals payload. `status: "unavailable"`
  carries a labeled `reason` and any field-level diagnostics.
- `topLevelReason`: present when `candidates` is empty (`"no_candidates"`)
  or when every candidate is unavailable
  (`"all_candidates_unavailable"`). Absent otherwise.

Invariants:

- The reader never returns a candidate for the current Run's own basename.
- The reader never returns a candidate for a YAML/JSON file that has no
  paired `.fit` sibling; such files become `no_paired_fit` only when they
  share a basename with another `.fit` candidate but the FIT is missing.
  Stray YAML/JSON files without any matching basename are silently ignored.
- YAML and JSON descriptors are interchangeable downstream. Both formats
  produce the same normalized field names (camelCase, matching
  `PrescriptionComparisonRunActuals`) regardless of the on-disk format.
- The reader chooses **`reject_ambiguous`** when both YAML and JSON
  artifacts share the same basename. Both files are surfaced as a single
  `ambiguous_artifact` descriptor referencing both source paths. The
  rationale: silently preferring one format would mask the runner's intent
  to keep two source-of-truth artifacts in parallel, and detection beats
  guessing for an irreversible delta. (This resolves the parent flag
  "same-basename YAML/JSON precedence" and the cycle PRD open question on
  YAML-vs-JSON precedence.)
- The Detailed-Profile eligibility rule is data-presence based. A
  descriptor is `eligible` only when the normalized content carries:
  `capturedDate` (ISO local date string), `comparisonGroup` (string), and
  at least one of the supported actuals fields (`avgPower`,
  `avgHeartRate`, `maxHeartRate`, `avgPace`, `rpe`). Missing
  `capturedDate` or missing `comparisonGroup` produces
  `partial_artifact` with the missing fields listed. Missing every actuals
  field also produces `partial_artifact`. (This resolves the parent flag
  "Detailed-Profile eligibility marker" and the cycle PRD open question on
  detailed-profile validation.)
- Comparison Group is compared by exact string equality after key-case
  normalization. A mismatch produces `comparison_group_mismatch`.
- A parsed artifact with a Comparison Group that matches the current
  Comparison Group but missing required fields produces `partial_artifact`,
  not `comparison_group_mismatch`. Eligibility classification has priority
  over filtering.
- The reader does not call `parseFitBuffer`, `parsePrescriptionNotation`,
  or any Plan loader. It does not read `plan.yaml`.
- The reader does not mutate any input and does not write to disk.

Error modes:

- A missing or unreadable `blockDirPath` returns `{ candidates: [],
  topLevelReason: "no_candidates" }` rather than throwing. The same shape
  is returned for an empty directory or a directory with no qualifying
  files. (This mirrors `scanBlockRuns` behavior.)
- A file that fails to parse as YAML or JSON returns
  `unparseable_artifact` with the underlying error's `message` string
  captured in `parseError`. The reader keeps processing other candidates.
- An invalid `currentFitBasename` (empty string) throws. An empty
  `comparisonGroup` throws. These are programmer errors that callers in
  this cycle prevent by construction.

## Acceptance criteria

- `readHistoryArtifacts` is implemented in the engine package and exported
  from `@run2max/engine` along with `HistoryArtifactDescriptor`,
  `HistoryArtifactEligible`, `HistoryArtifactUnavailable`,
  `HistoryArtifactReport`, `ReadHistoryArtifactsOptions`, and
  `HistoryRequiredField` types.
- The reader discovers candidate basenames by listing `.fit` files in
  `blockDirPath` and pairing each one to a sibling `.yaml`, `.yml`, or
  `.json` Analysis Artifact with the same basename.
- The current Run's `currentFitBasename` is excluded from candidates even
  when its sibling artifact exists.
- Stray YAML or JSON files without a matching `.fit` basename are ignored
  and produce no descriptor.
- YAML artifacts are parsed and snake_case keys are normalized to
  camelCase so descriptors share one shape regardless of on-disk format.
- JSON artifacts are parsed and consumed as-is for keys that already match
  the camelCase shape; non-matching JSON keys produce `partial_artifact`
  with the missing-field list.
- A basename with both a YAML and a JSON sibling produces exactly one
  `ambiguous_artifact` descriptor with both source paths listed.
- An artifact with a Comparison Group equal to `options.comparisonGroup`
  and all required fields present produces an `eligible` descriptor with a
  populated `actual` payload matching `PrescriptionComparisonRunActuals`.
- An artifact whose normalized Comparison Group differs from
  `options.comparisonGroup` produces `comparison_group_mismatch`.
- An artifact missing `capturedDate`, missing `comparisonGroup`, or with
  zero supported actuals fields produces `partial_artifact` with the
  exact missing fields listed in `missingFields`.
- An artifact that fails to parse produces `unparseable_artifact` with
  `parseError` carrying the underlying error message.
- Missing or unreadable `blockDirPath` returns
  `{ candidates: [], topLevelReason: "no_candidates" }` without throwing.
- Empty `currentFitBasename` or empty `comparisonGroup` throws.
- No `quantify` integration, no `AnalysisResult` field change, no
  formatter change, no CLI flag, no Plan schema change, and no
  Prescription Comparison semantic change is introduced in this sub-issue.
- Repository-runnable verification commands pass at closure, including
  `pnpm test` and `pnpm build`.

## Proposed tests

1. **Discovers paired YAML artifact** -- a Block fixture with one prior
   `.fit` and a sibling `.yaml` Analysis Artifact whose Comparison Group
   matches returns one `eligible` descriptor with the parsed actuals.
2. **Discovers paired JSON artifact** -- the same case with a sibling
   `.json` artifact returns one `eligible` descriptor; YAML and JSON
   descriptors are field-for-field equivalent.
3. **Excludes current basename** -- a Block fixture containing both a prior
   artifact and an artifact whose basename equals `currentFitBasename`
   returns exactly one descriptor for the prior basename.
4. **Ignores unpaired stray artifacts** -- a Block fixture with a
   `lonely-file.yaml` whose basename has no sibling `.fit` returns no
   descriptor for that file.
5. **Same-basename ambiguity rejection** -- a basename with both a `.yaml`
   and `.json` sibling produces exactly one `ambiguous_artifact`
   descriptor listing both source paths.
6. **YAML snake_case normalization** -- a YAML fixture with snake_case keys
   (`avg_power`, `comparison_group`) is normalized so the descriptor's
   `actual.avgPower` and `comparisonGroup` are populated.
7. **Comparison Group mismatch** -- an artifact with
   `comparisonGroup: "Tuesday Intervals"` and a caller-supplied
   `comparisonGroup: "Saturday Long"` produces
   `comparison_group_mismatch`.
8. **Partial artifact -- missing captured date** -- an artifact with
   `comparisonGroup` present but `capturedDate` missing produces
   `partial_artifact` with `["capturedDate"]` in `missingFields`.
9. **Partial artifact -- missing all actuals** -- an artifact with
   `capturedDate` and `comparisonGroup` present but all actuals fields
   absent produces `partial_artifact` listing the missing actuals fields.
10. **Eligibility wins over Comparison Group filter** -- an artifact with
    matching `comparisonGroup` but missing `capturedDate` produces
    `partial_artifact`, not `comparison_group_mismatch`.
11. **Unparseable YAML** -- a corrupted YAML fixture produces
    `unparseable_artifact` with `parseError` populated; sibling artifacts
    continue to be processed.
12. **Unparseable JSON** -- a JSON fixture with invalid syntax produces
    `unparseable_artifact`; the rest of the directory still classifies
    correctly.
13. **Empty directory** -- a Block fixture with no `.fit` files returns
    `{ candidates: [], topLevelReason: "no_candidates" }`.
14. **Missing directory** -- a non-existent path returns the same shape
    without throwing.
15. **All candidates unavailable** -- a fixture where every prior artifact
    is partial or mismatched returns
    `topLevelReason: "all_candidates_unavailable"`.
16. **Empty current basename throws** -- calling with
    `currentFitBasename: ""` throws.
17. **Empty Comparison Group throws** -- calling with
    `comparisonGroup: ""` throws.
18. **Eligible actuals match contract** -- an `eligible` descriptor's
    `actual` field type-checks as `PrescriptionComparisonRunActuals` and
    preserves nulls for fields the artifact explicitly recorded as null.
19. **Public export smoke test** -- consumers can import
    `readHistoryArtifacts` and the descriptor types from `@run2max/engine`.

## Affected artifacts

- `packages/engine/src/plan/history.ts` (new) -- implements
  `readHistoryArtifacts`, the descriptor types, ambiguity rule, eligibility
  rule, and key-case normalization wiring.
- `packages/engine/src/plan/history.test.ts` (new) -- exercises the reader
  through fixture directories. May colocate fixtures under
  `packages/engine/src/plan/__fixtures__/history/`.
- `packages/engine/src/types.ts` -- add the public types for descriptors,
  options, and required-field enum. No change to `AnalysisResult`,
  `QuantifyOptions`, or existing comparison types.
- `packages/engine/src/index.ts` -- export `readHistoryArtifacts` and its
  public types.
- `packages/engine/src/plan/case-keys.ts` -- only if the inverse
  (snake-to-camel) helper is not yet exported; reuse the existing
  helper otherwise. Do not add a parallel normalization utility.
- `context/cycles/02-run-prescriptions-and-comparisons/issues/66-comparable-history-deltas/issue.md`
  -- update the two MUST-RESOLVE flags to record the chosen rules
  (`reject_ambiguous`; data-presence eligibility with the field list above)
  once this sub-issue's implementation lands.

## Dependencies

- Parent #66 must remain the active parent scope.
- Closed parent #59 supplies the Block-directory convention and the
  `comparisonGroup` field on `PrescribedRunContext`; this sub-issue does
  not change that contract.
- Closed parent #60 supplies the `PrescriptionComparisonRunActuals` type
  used as the descriptor's `actual` payload shape.
- Existing `transformKeysCamelToSnake` (and an inverse) is the only
  sanctioned key-case helper. Do not introduce a parallel utility.
- Do not call `parseFitBuffer`, `parsePrescriptionNotation`, `loadPlan`,
  `walkPlan`, `quantify`, `formatResult`, or any FIT/Plan I/O from the
  reader.
- Do not introduce CLI flags, config schema fields, persistence layers, or
  changes to existing Output Profile sections in this sub-issue.
