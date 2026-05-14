# Cycle 02 — Reliability Pass Audit Findings (Opus)

> Status: resolved by parent #73. This document is the technical audit source
> for the Reliability Pass that takes cycle 02 from `Prototype` to `Reliable`;
> closure evidence lives in
> `issues/73-reliability-pass-for-cycle-02/aar.md`. It is not adversarial; code
> was written by peers. Modules with no findings are reported as clean -- that is
> success, not failure.

## Scope

The Reliability Pass covers the whole cycle 02 boundary:

- Parent #53 — Prescribed Run model & Notation parser
- Parent #59 — Run prescription association & override
- Parent #60 — Lap-aligned prescription comparison
- Parent #63 — Prescription comparison output
- Parent #66 — Comparable-history deltas (sub-issues #67, #69, #70, #71)
- Cross-cutting: tests, build, type-checking, ADR coverage

## Build & test health

- `pnpm test` (vitest, single run from repo root): **PASS** — 36 files, 610
  tests passed; 6 tests skipped (all `it.skipIf(!hasFixture)` in
  `packages/engine/src/smoke.test.ts:34-123`, gated on an optional Stryd fixture
  that does not live in the repo). Duration ~0.9s.
- `pnpm -r build` (engine + cli via tsup with DTS): **PASS** — engine
  ESM/CJS/DTS clean; cli ESM clean. No standalone `typecheck` script exists in
  this monorepo; the tsup DTS build is the proxy and both packages pass.
- No failing tests, no flaky tests observed.

Post-pass verification at parent #73 closure:

- `pnpm test`: **PASS** -- 36 files passed, 1 skipped; 635 tests passed, 6
  skipped.
- `pnpm -r build`: **PASS** -- engine and CLI package builds completed; engine
  DTS emitted successfully.

## Finding buckets

Each finding is labelled:

- **Must-fix before Reliable closure** — blocks the assurance claim (contract
  violation, silent failure mode for in-scope cases, missing test for a
  documented PRD success metric).
- **Deferred with rationale** — known/acceptable debt; document in the AAR or a
  follow-up issue.
- **Out-of-cycle opportunity** — improvement outside the cycle 02 feature-set
  boundary; seed a future cycle rather than expand this pass.

---

## Parent #53 — Prescribed Run model & Notation parser

Files: `packages/engine/src/plan/{prescription,schema,types,loader}.ts` and
their `.test.ts` siblings. ADR 0005 covers "Prescribed Runs store expanded steps
on the parsed Plan" — but two other implicit decisions are undocumented (below).

### Clean

- Parser is pure: no I/O, no formatter imports, no `Date.now()`/randomness.
  Framework-agnostic.
- Discriminated union for `PrescribedStepTarget`
  (`packages/engine/src/plan/types.ts`) is well-formed; no `any`/`unknown`
  leakage.
- `splitTopLevel` correctly tracks parenthesis depth for both `->` / `→` and
  internal `/` separators (`packages/engine/src/plan/prescription.ts:30-49`).
  Unicode `→` is a single UTF-16 code unit and is handled correctly.
- Schema addition is non-breaking: `prescribed_runs` optional under
  `schemaVersion: 1`; existing fixtures continue to parse
  (`packages/engine/src/plan/schema.ts:33`).

### Must-fix before Reliable closure

1. **`requireTargetRanges` option is dead at the plan-load seam.**
   `packages/engine/src/plan/schema.ts:109` calls
   `parsePrescriptionNotation(run.prescription)` with no options. The PRD
   success metric "Invalid Prescription Notation fails with actionable
   diagnostics, including missing Target Ranges on numerically comparable
   intensity steps" is therefore not enforced from `parsePlan`. The
   `missing_target_range` diagnostic code is only reachable when callers pass
   the flag directly, which production code does not.

2. **No "numerically comparable" classification.** `requireTargetRanges` is a
   single global boolean (`packages/engine/src/plan/prescription.ts:88`).
   Turning it on would reject perfectly valid easy/recovery steps such as
   `1min @ E`. The PRD intent is per-step (Target Range required when the
   intensity label denotes a numerically comparable zone). Either the parser
   distinguishes comparable vs non-comparable labels, or an ADR explicitly
   defers that decision and documents the current binary flag as inadequate.

3. **Target Range numeric invariants not validated.**
   `packages/engine/src/plan/prescription.ts:111-117` accepts `[234-205W]`
   (min > max), `[0-0W]`, and arbitrary magnitudes. A reversed range will
   silently produce a target that no captured power matches. Add `min <= max`
   and (probably) `min >= 0` validation, with tests.

4. **Distance/duration values not bounds-checked.** `0K @ E[…]`, `0min @ T[…]`,
   and arbitrarily large repetition counts (`9999(...)`) are accepted
   (`packages/engine/src/plan/prescription.ts:84-104,132`). Zero-length steps
   cascade into nonsense downstream Segments; very large repetition counts
   amplify a fat-finger error.

5. **Nested repetition fails as generic syntax error rather than
   `unsupported`.** `parseSegment` only recurses one level — the inner of a
   repeat is fed to `parseStep`, not `parseSegment`
   (`packages/engine/src/plan/prescription.ts:149-152`). A user authoring
   `2(3min @ E/2(1min @ T/30sec @ R))` sees "Unsupported or malformed
   prescription notation" with no indication that nesting is the issue. PRD does
   not require nesting; it does require _actionable_ diagnostics.

6. **Diagnostics drop structured context at the loader boundary.** `parsePlan`
   throws a plain `Error` carrying only `diagnostics[0]?.message`
   (`packages/engine/src/plan/schema.ts:111-114`); the `code`, `token`, and
   (always-undefined) `offset` fields are discarded. `loader.ts:30-41` only
   special-cases `ValiError`, so the prescription error bubbles up without
   filePath context.

7. **Parser short-circuits on first error.**
   `packages/engine/src/plan/prescription.ts:151,200-202` returns immediately
   after the first diagnostic. The `diagnostics: []` shape is plural by contract
   but always length 1. A user with three malformed steps sees only one.
   Anti-pattern for parsers at the Reliable bar.

8. **`PrescriptionDiagnostic.offset` declared but never populated.**
   `packages/engine/src/plan/prescription.ts:7` — either set it (so callers can
   underline the offending span) or remove it; a permanently-undefined optional
   silently violates the contract.

### Deferred with rationale

- **Case sensitivity of units.** `K`, `min`, `W` are case-sensitive; `1.6k`,
  `3MIN`, `3Min`, `[205-234w]` all fail. Matches PRD examples literally.
  Document as an AAR note; consider case-insensitivity in a future cycle.
- **`source` on expanded repeated steps is the pattern source, not the runtime
  instance.** All four `3min @ SUB-T[260-280W]` reps in
  `4(3min @ SUB-T[260-280W]/1min @ E)` share an identical `source`
  (`packages/engine/src/plan/prescription.ts:119`). Acceptable for diagnostics;
  downstream formatters must not assume uniqueness.
- **`targetRange.metric: "power"` is a single-variant union.**
  (`packages/engine/src/plan/types.ts:9`) — HR/pace targets are out of scope.
  The type pre-commits to power-only without an ADR; document intent.

### Out-of-cycle opportunity

- **Comparison Group is an unconstrained string** in both schema and type
  (`packages/engine/src/plan/schema.ts:23`, `types.ts:31`). Future cycles should
  either intern these to a known set or enforce a format; downstream
  assoc/comparison reliability hinges on stable equality.
- **`localDate` accepts any string** (`packages/engine/src/plan/schema.ts:20`).
  Promote to a shared ISO-date validator (same as `Week.start`).

### Test coverage gaps (Reliable bar)

None of the following are covered in `prescription.test.ts`:

- Interleaved arrow types (`A -> B → C`).
- `→` inside a repetition body.
- Min > max Target Range; zero-value distance/duration.
- Leading/trailing whitespace and lone-arrow inputs (`"->"`, `"1.6K @ E ->"`).
- Nested repetition (negative case).
- `requireTargetRanges: true` over mixed comparable / non-comparable labels.
- Integration test asserting the `parsePlan` error _message_ shape for a
  malformed prescription (currently only `.throws()`).
- Explicit fixture-without-`prescribed_runs` round-trip (claimed by AC, only
  implicitly covered today).

### ADR-worthy decisions undocumented

- Eager plan-load throw versus per-Week diagnostic collection. Today's choice
  couples Plan validity to Prescription Notation validity; reverting later is
  hard.
- The binary `requireTargetRanges` flag instead of a "numerically comparable"
  classification.

---

## Parent #59 — Run prescription association & override

Files: `packages/engine/src/plan/associate.{ts,test.ts}`,
`packages/engine/src/computations/quantify.{ts,test.ts}`,
`packages/cli/src/commands/quantify.{ts,test.ts}`,
`packages/engine/src/{index,types}.ts`.

### Clean

- Selector grammar matches the PRD-resolved contract — bare `YYYY-MM-DD` and
  `date:YYYY-MM-DD` → date; `label:<x>` and bare text → label; `label:` is the
  escape hatch for date-shaped labels
  (`packages/cli/src/commands/quantify.ts:36-70`). Helper tested at
  `quantify.test.ts:56-96`.
- Default association uses `Intl.DateTimeFormat("en-CA", { timeZone })` for
  UTC→local conversion (`packages/engine/src/plan/associate.ts:53-60`), then
  matches Weeks by lexicographic ISO-date compare. Timezone boundary test exists
  (`associate.test.ts:187-201`).
- `findPrescribedRun` is a pure function over parsed `Plan` + `Date` +
  timezone + structured options. No I/O, no `Date.now()`, no randomness.
- Engine surface in `packages/engine/src/index.ts:45-51` exports exactly the
  contract the sub-PRD committed to. CLI duplicates no engine logic.
- `prescribedRunContext` and `prescriptionComparison` are both optional on
  `AnalysisResult` (`packages/engine/src/types.ts:253-257`); comparison without
  context is unrepresentable.
- No hidden mutation of the Plan object.

### Must-fix before Reliable closure

1. **CLI silently drops `ambiguous`, `no_prescribed_run`, and `no_week` reasons
   when the user explicitly supplied `--prescribed-run`.**
   `packages/engine/src/computations/quantify.ts:156` is the only consumer of
   the association result; on `ok: false` the reason is discarded and
   `prescribedRunContext` is left `undefined`. A runner who passes
   `--prescribed-run "Wednesday Intervals"` against an ambiguous label fixture
   gets no feedback at all. Sub-issue #57 and parent #59 both require
   `ambiguous` to be a labeled, user-visible outcome. At minimum the CLI must
   surface non-zero exit / stderr when the user-supplied override fails to
   match.

2. **No test asserts current CLI override-failure behavior.** Whether you choose
   to keep the silent path or make it loud, the absence of a regression guard at
   the CLI seam violates the Reliable bar.

3. **No engine test for "duplicate dates in another Week do not produce
   `ambiguous` in default mode".** `findPrescribedRun` correctly restricts
   default-mode matching to the matched Week
   (`packages/engine/src/plan/associate.ts:166-168`), but the invariant is
   untested and easy to regress.

### Deferred with rationale

- **CLI date validity is regex-only.** `LOCAL_DATE_RE`
  (`packages/cli/src/commands/quantify.ts:34`) accepts `2026-02-31`,
  `2026-13-01`, `0000-00-00`. The CLI then sends a never-matching `overrideDate`
  to the engine, surfacing only the generic `no_prescribed_run` reason. The
  sub-issue commits to a CLI validation error for malformed `date:`. Either
  upgrade the validator to a real calendar check or accept the deferral with an
  AAR note.
- **DST transition not exercised.** No test asserts that a DST-transition Sunday
  (e.g. America/Santiago in April / September) classifies correctly. Code path
  is correct because it always uses the resolved IANA timezone rather than
  Stryd's metadata; worth an explicit assertion test for the Mexico-City-stuck
  Stryd profile case.
- **Leap-year / year-boundary tests missing** (`2024-02-29` is accepted by the
  regex; `2025-02-29` is also accepted — only engine match decides).
- **Label whitespace/case normalization is consistent but undocumented.**
  `selector.trim()` trims the outer value;`label:  Foo  ` becomes
  `overrideLabel: "Foo"` after the inner `.trim()`
  (`packages/cli/src/commands/quantify.ts:56-60`).
- **No end-to-end CLI test for `date:` or `label:` invocations.** Only the
  helper is tested; the command-level tests cover bare date and bare label only.
- **`comparableHistory` merge widens the discriminated union back to
  `PrescriptionComparison`**
  (`packages/engine/src/computations/quantify.ts:179-217`). Type-safe today;
  brittle to future refactor.

### Out-of-cycle opportunity

- `packages/cli/src/commands/quantify.ts:286-291` silent catch on auto-discover
  (pre-existing, not introduced by #59).
- `packages/engine/src/plan/associate.ts:213-216,240-243` silent per-file parse
  errors in `scanBlockRuns` (pre-existing).

---

## Parent #60 — Lap-aligned prescription comparison

Files:
`packages/engine/src/computations/{prescription-comparison,quantify,segments,aggregate}.{ts,test.ts}`,
`packages/engine/src/types.ts`, `packages/engine/src/formatters/markdown.ts`.

### Clean

- Unavailable taxonomy is a discriminated string-literal union
  `reason: "missing_laps" | "step_count_mismatch"`
  (`packages/engine/src/types.ts:343`). Both are produced, not thrown.
- No interval-detection heuristic exists. `quantify` feeds `finalSegments` only
  (`packages/engine/src/computations/quantify.ts:173-177`), and
  `computeSegments` derives buckets exclusively from `laps[]`
  (`packages/engine/src/computations/segments.ts:26-64`).
- Comparison never reads `config.zones` or `avgPowerZone`. Only
  `step.targetRange` + `segment.avgPower` (per the PRD non-goal).
- All PRD per-step output fields are present: avg power, avg HR, avg pace,
  distance, duration, lapIndex, plus run-level RPE/maxHR. No per-step RPE
  leakage.
- Duration tolerance `{short: 5, long: 10}` and distance tolerance
  `{short: 50, long: 200}` match the sub-PRD; inclusive boundaries verified
  (`prescription-comparison.test.ts:153-239`).
- Pure, framework-agnostic, deterministic (no `Date.now()`/`Math.random()`).
- Discriminant `status` is consistent; all consumers use
  `status === "available"` guards.

### Must-fix before Reliable closure

None blocking. The contract is sound and matches the sub-PRD.

### Deferred with rationale

- **No exhaustive `never` check in the formatter unavailable branch.** The
  Markdown formatter uses a single `if (comparison.status === "unavailable")`
  and prints `comparison.reason` as a free-form string
  (`packages/engine/src/formatters/markdown.ts:410-415`); adding a third reason
  later would flow through silently. Same for `json.ts` and `yaml.ts`.
- **Inclusive power-boundary semantics undocumented.** `<` / `>` only — values
  exactly at min/max are `within`
  (`packages/engine/src/computations/prescription-comparison.ts:44,53`). PRD
  documents inclusivity only for completion, not for power. Add an invariant
  comment and a float-boundary test.
- **Floating-point noise in power deltas.** `avgPower` is a weighted average
  (`packages/engine/src/computations/aggregate.ts:33-49`) and can be
  non-integer; `deltaToMin`/`deltaToMax` may carry float noise (e.g.
  `5.9999999`). Acceptable for evidence reporting; flag if a test ever becomes
  flaky.
- **Test gaps for `prescribedValue === 0` ratio-null path
  (`prescription-comparison.ts:86,110`); missing HR (`avgHeartRate === null` in
  segment); missing pace; "fewer segments than steps" branch (current tests only
  cover more-segments-than-steps); warmup/cooldown extra-lap scenario;
  integration tests through `quantify` for `missing_laps` and
  `step_count_mismatch` (sub-issue #61 proposed-tests #17 not yet covered).**
- **Degenerate guard ordering.** Both `steps=0` + `segments=0` paths exit as
  "available" with empty rows. Likely an upstream invariant, but worth an
  explicit defensive check.

### Out-of-cycle opportunity

- **Trailing-lap tolerance.** Extra cooldown laps or autopause-induced laps
  disable comparison wholesale via `step_count_mismatch`. Reasonable for v1 but
  brittle in practice. Would require a new reason or pairing rule;
  scope-expanding for cycle 02.
- `packages/engine/src/computations/segments.ts:73-76` — `distance = lastDist
  - firstDist` returns 0 when distance fields are absent. Not a #60 bug but
    worth a note for a future telemetry-cleanup pass.

---

## Parent #63 — Prescription comparison output

Files:
`packages/engine/src/formatters/{index,markdown,json,yaml,utils}.{ts,test.ts}`,
`packages/engine/src/plan/case-keys.ts`.

### Clean

- All three formats expose `prescription_comparison` through the same profile
  gate (`packages/engine/src/formatters/index.ts:150-152`); default profile
  includes it; no verbosity flag silently drops it
  (`formatters/index.test.ts:649-675`).
- JSON and YAML serialize the engine's structured `PrescriptionComparison`
  verbatim (`json.ts:57`, `yaml.ts:58`). Discriminant `status` and reasons
  (`step_count_mismatch`, `missing_laps`, `ambiguous_artifact`,
  `partial_artifact`, `missing_prior_value`, etc.) carry through. Verified at
  `formatters/index.test.ts:932-946,1048-1074`.
- Markdown renders from the same structured value; no recomputation or duplicate
  association logic (`markdown.ts:399-503`).
- Unavailable shape surfaces reason + counts and avoids fabricating step tables
  (test at `formatters/index.test.ts:559-567`).
- `skipSegmentsIfSingleLap` and column filtering do not hide Prescription
  Comparison (`formatters/index.test.ts:864-874,1089-1104`).
- YAML key-case transform is a single seam (`plan/case-keys.ts:20`), inverse
  exists (`case-keys.ts:7`).

### Must-fix before Reliable closure

None.

### Deferred with rationale

- **`camelToSnakeKey` is one-way lossy for keys containing single uppercase /
  all-uppercase tokens** — a hypothetical `LTHR` would snake to `_l_t_h_r`.
  Today's emitted keys all use single-uppercase camelCase and the transform is
  safe by inspection, but the constraint is undocumented and there is no
  round-trip test. Belongs to the comparable-history parent that owns the
  YAML/JSON artifact contract.
- **YAML `metric` field value stays camelCase.** `camelToSnake` is keys-only by
  design; the emitted document contains `metric: avgPower` next to
  `reason: missing_prior_value`. Tests at `index.test.ts:1060-1075` only assert
  keys, not enum values. Either accept the asymmetry (enum identifiers are
  stable strings, not user-facing labels) or snake-case the metric enum when
  emitting YAML.
- **No stable-ordering test for `prescriptionComparison` keys/sections.**
  Ordering is currently object-literal-insertion order in `applyProfile` and
  deterministic in practice for V8, but a re-keying refactor could silently
  shuffle YAML output and break artifact byte stability for comparable history.

### Out-of-cycle opportunity

- **NaN/Infinity in JSON/YAML.** `JSON.stringify` emits `null` silently; the
  `yaml` library emits `.nan`/`.inf`. No formatter-level guard exists in
  `json.ts`/`yaml.ts`. Engine types these fields as `number | null` so this is
  upstream discipline; worth a single-line invariant somewhere.
- **`weatherPerSplit`** assembled into `FilteredResult`
  (`formatters/index.ts:141`) but never emitted in `json.ts`/`yaml.ts`.
  Pre-existing — not introduced by #63 — but worth noting for the next
  reliability pass.
- **Markdown comparable-history assertions test exact padded substrings**
  (`formatters/index.test.ts:595` — `"|       -1 |"`), coupling tests to
  `padTable` width math. Brittle but conforms to PRD because the same data is
  checked structurally in JSON branch.

---

## Parent #66 — Comparable-history deltas

Files: `packages/engine/src/plan/{history,case-keys}.{ts,test.ts}`,
`packages/engine/src/computations/{comparable-history,quantify}.{ts,test.ts}`,
`packages/cli/src/commands/quantify.{ts,test.ts}`,
`packages/engine/src/formatters/{markdown,json,yaml,index}.{ts,test.ts}`,
`packages/engine/src/types.ts`.

### Clean

- Reader parse-error containment: separate try/catch around `readFile` and
  `parseYaml`/`JSON.parse` (`packages/engine/src/plan/history.ts:140-166`).
  Ambiguous-artifact emission (`history.ts:306-313`), `no_candidates` on missing
  dir (`history.ts:281-285`), empty-input throwing (`history.ts:273-278`), and
  explicit current-basename exclusion (`history.ts:293`).
- Delta computation: non-finite handling (`NaN`/`Infinity` → missing) at
  `comparable-history.ts:45`; stable metric order at `:48-54`; input
  non-mutation; exhaustive reason discrimination; public exports from
  `@run2max/engine`.
- Type safety: discriminated union on `status`, exhaustive metric union,
  exhaustive unavailable-reason union. Consumers in `quantify.ts` and
  `markdown.ts` narrow correctly.
- Engine/CLI coupling: CLI only derives `currentFitBasename` via `path.basename`
  and passes through (`packages/cli/src/commands/quantify.ts:258`).
- Key-case normalization is recursive, idempotent, key-only, does not touch
  arbitrary string values (`packages/engine/src/plan/case-keys.ts`).
- Quantify integration: all four inert gates tested
  (`quantify.test.ts:331-527`); integration owns orchestration and does not
  duplicate reader/delta arithmetic.

### Must-fix before Reliable closure

1. **Uppercase `.FIT` extension collides between CLI basename derivation and
   reader filter.** CLI: `basename(args.file, extname(args.file))` correctly
   strips `.FIT`. Reader filters with `entry.endsWith(".fit")`
   (`packages/engine/src/plan/history.ts:291`). On case-insensitive filesystems
   (macOS default), a user invoking `run2max quantify run-1.FIT` would have the
   current run _not_ excluded from candidates. Either lowercase-normalize the
   FIT extension in the reader filter or document uppercase `.FIT` as
   unsupported with a CLI validation error.

### Deferred with rationale

- **`readdir` not called with `withFileTypes`** in FIT discovery
  (`packages/engine/src/plan/history.ts:282`). A directory named `run-1.fit/`
  would be classified as a FIT file. Real-world risk low; a `Dirent.isFile()`
  guard would close it.
- **`.yaml` vs `.yml` silent precedence.** `pickArtifactPath`
  (`packages/engine/src/plan/history.ts:82-90`) picks `.yaml` over `.yml`
  silently when both exist. The parent's `ambiguous_artifact` policy is enforced
  only between YAML and JSON, not between two YAML extensions. Either pick one
  extension as canonical or emit `ambiguous_artifact` for `.yaml` + `.yml`
  collisions.
- **`partial_artifact` early-return loses field context.** In
  `classifySingleArtifact` (`packages/engine/src/plan/history.ts:210-226`), when
  `duration` or `distance` is missing/non-finite, the function returns with
  `missingFields` as accumulated so far but never adds `"duration"` or
  `"distance"` (they aren't part of `HistoryRequiredField`). Either add them to
  the field enum or document the structural-vs-semantic distinction.
- **Pace sign convention undocumented in code.** Delta direction is
  `current - prior` for all metrics including `avgPace`
  (`packages/engine/src/computations/comparable-history.ts:70`); lower pace =
  faster, so "faster than prior" produces a _negative_ pace delta. Add a
  one-line JSDoc on `computeComparableHistoryDelta`.
- **`prescribedRunContext.comparisonGroup` is truthy-checked**
  (`packages/engine/src/computations/quantify.ts:181`). Empty string is treated
  as "no comparison group" silently. Defensive `trim().length > 0` would be more
  explicit.
- **Markdown candidate reasons join with `; ` on a single line**
  (`packages/engine/src/formatters/markdown.ts:494`). Cosmetic for many
  candidates.
- **Defensive empty-runs fallback** (`markdown.ts:465-466`) silently masks a
  logical case that sub-issue #70 is documented to handle. Worth a code comment
  so it isn't deleted later under the impression it's dead.
- **No exhaustive `never` check** on `comparableHistory.status` in the formatter
  (`markdown.ts:491`'s `else` would swallow a third status).
- **`comparableHistory` is attached only on the `available` branch.** Matches
  the sub-issue contract, but `PrescriptionComparisonUnavailable` carries no
  signal that history was even possible. Future-cycle question.
- **Test gaps**: `rpe: 0` end-to-end preservation (falsy-but-valid);
  hand-authored YAML whose top-level is a string/array (reader returns
  `partial_artifact` with a massive `missingFields` list — safe but unasserted);
  YAML/JSON semantic-equivalence round-trip (emit + re-read); any test forcing a
  FIT run captured around midnight in a non-UTC zone.

### Out-of-cycle opportunity

- **Sequential `readFile` over all paired artifacts** in reader. Acceptable for
  typical block sizes (<10 files); revisit if `scanBlockRuns` parallelizes.
- **`comparison_group_mismatch` not surfaced at the top level.** A directory of
  only mismatched runs surfaces as `all_candidates_unavailable`, which is
  correct but a little misleading; consider a top-level reason expansion in a
  future cycle.

---

## Cross-cutting: tests, build, ADRs

### Clean

- Cycle 02 tests overall comply with SDP patterns: structured-data assertions on
  JSON/YAML output alongside markdown prose checks
  (`packages/engine/src/formatters/index.test.ts:880-946`); parser exposes
  diagnostic `code` rather than message strings
  (`packages/engine/src/plan/prescription.test.ts:77,87,96`);
  association/history return discriminated `reason` codes that tests check by
  tag (`packages/engine/src/plan/associate.test.ts:273-362`,
  `history.test.ts:52-425`); FS-touching tests all isolate to
  `mkdtemp(tmpdir(),…)` with `try/finally` `rm` cleanup.
- No fixture under `fixture-fits/` or `plans/` is written by any cycle-02 test.
- No test relies on side-effects from an earlier test.

### Deferred with rationale

- **Brittle exact-string error assertions** in three places:
  `packages/engine/src/plan/history.test.ts:437,447`
  (`"currentFitBasename must be non-empty"`,
  `"comparisonGroup must be non-empty"`); and
  `packages/cli/src/commands/quantify.test.ts:81-95`
  (`"--prescribed-run date: must use YYYY-MM-DD"`). These will regress if
  wording changes; promote to typed error codes if the messages are intended as
  a stable UX contract.
- **Wide `vi.mock` of `normalize-fit-file`** in
  `packages/engine/src/computations/quantify.test.ts:8-11` and 18+ call sites.
  Justified (FIT parsing isn't the unit under test); flag only if upgrades
  become frequent.
- **CLI `quantify.test.ts` mocks the entire `@run2max/engine` module**
  (`packages/cli/src/commands/quantify.test.ts:21-32`). Appropriate for a CLI
  seam test; engine contract tests cover the same surfaces from the other side.

### Out-of-cycle opportunity

- **Markdown formatter tests**
  (`packages/engine/src/formatters/index.test.ts:540-627`) assert on rendered
  prose (`"Match Kind: date"`, `"Comparison Group: ..."`). PRD goal is satisfied
  because the same data is also checked structurally in the JSON branch; prose
  tests are UI sugar, not the only surface.
- **No real-FIT smoke test runs in CI.**
  `packages/engine/src/smoke.test.ts:34-123` are gated on a fixture that does
  not live in the repo, so cycle 02's lap-aligned comparison logic is never
  exercised against a real Stryd FIT. Unit tests use fabricated `SegmentRow[]`;
  any drift between `normalize-fit-file`'s lap output and the fabricated shape
  would not surface. Add a checked-in minimal FIT fixture in a future cycle.

### ADR coverage

- Resolved by parent #73: ADR 0006 documents comparable intensity label
  classification and the v1 repetition cap; ADR 0007 documents eager
  `parsePlan` throws via typed `PrescriptionNotationError` rather than a result
  type.

---

## Closure-evidence checklist (post-Reliable-Pass)

Resolved in parent #73 closure:

- Must-fix findings resolved by sub-issues #74 through #77.
- Audit-driven refactors were scoped to behavior preservation and owning seams.
- `pnpm test` green after refactor.
- `pnpm -r build` (DTS) green after refactor.
- ADRs 0006 and 0007 added for the two consequential decisions.
- Parent #73 AAR and cycle AAR record the Reliability Pass evidence.
