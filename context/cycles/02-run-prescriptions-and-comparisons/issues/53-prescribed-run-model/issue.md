# Parent Issue #53 -- Prescribed Run model and notation

> Technical execution doc. Sub-issues live in sibling `XX-...` folders.

## Acceptance criteria

- `plan.yaml` accepts optional `prescribed_runs` under each Week with no
  `schemaVersion` bump. Existing Plan fixtures without `prescribed_runs` remain
  valid and parse to the same effective Plan data they do today.
- The engine exposes named structured types for the new Plan prescription data:
  at minimum `PrescribedRun`, `PrescribedStep`, and a numeric `TargetRange`
  shape. Public consumers do not need to inspect raw YAML fragments or parser
  internals to use them.
- A Prescribed Run can carry a local day/date, label, compact Prescription
  Notation, optional Comparison Group, and the minimum metadata later needed to
  associate a captured Run by date or explicit override.
- Prescription Notation v1 parses ordered steps separated by ASCII `->` or
  Unicode `→`, repetition groups such as `4(...)`, `/` between repeated
  work/recovery steps, distance targets such as `1.6K`, duration targets such as
  `3min`, intensity labels after `@`, and inline Target Ranges such as
  `[205-234W]`.
- Parsed notation expands into an ordered Prescribed Step sequence that includes
  warmups, reps, recoveries, cooldowns, and any other authored step. Repetition
  expansion preserves authored order and produces the step count later used for
  lap-aligned comparison.
- Invalid Prescription Notation fails with actionable diagnostics. Diagnostics
  identify the malformed token or unsupported construct and distinguish missing
  Target Ranges for numerically comparable intensity steps from syntax errors.
- Inline Target Ranges are preserved as authored numeric comparison targets. The
  parser does not look up mutable Zone values from config or Testing Period
  history.
- Structured parser tests cover valid simple steps, repeated work/recovery
  groups, both arrow spellings, distance and duration targets, optional
  Comparison Group metadata, invalid syntax, and missing required Target Range
  diagnostics.
- This parent does not add Run association, FIT lap comparison, rendered
  prescription-comparison output, or comparable-history lookup. Any temporary
  helper added for tests remains local to the Plan/prescription modules.
- Repository-runnable verification commands succeed across the workspace at
  parent closure, including `pnpm test` and any package build/DTS checks that
  are already defined in this repository.

## Implementation approach

1. Design the Week-level `prescribed_runs` shape before implementation. Compare
   a minimal authored shape that stores notation plus metadata against an
   eagerly expanded shape that stores parsed Prescribed Steps on the parsed
   Plan. Choose the smallest surface that still lets downstream parents avoid
   reparsing notation.
2. Extend the Plan schema and named Plan interfaces so `prescribed_runs` is
   optional on `Week`. Keep existing Plans valid under `schemaVersion: 1` and
   keep optional-field semantics aligned with the existing parser.
3. Add a prescription parser module under the engine Plan area. Keep it free of
   CLI formatting concerns and free of FIT/Segment comparison logic.
4. Implement the v1 grammar incrementally through structured tests: simple
   single steps, arrow-separated sequences, repetition groups, work/recovery
   separators, target parsing, intensity labels, and diagnostic failures.
5. Expand parsed notation into ordered Prescribed Steps with stable step indexes
   and typed target data. Preserve enough authored metadata for later output to
   explain what was compared without needing the original parser internals.
6. Export only the domain types and parser entry points needed by later parents
   from `@run2max/engine`. Avoid adding formatter helpers, CLI-only aliases, or
   convenience APIs until a downstream caller proves they are needed.
7. Add or update Plan fixtures to show a Week with `prescribed_runs` while
   preserving existing fixture behavior. Run repository-runnable verification
   commands and record any closure flags if current scripts are missing.

If implementation decomposes into more than one vertical slice, add sibling
sub-issues under this parent. Today the expected first slice is the Plan shape,
parser interface, and parser behavior together because downstream parents need
that full contract before they can start.

## Dependencies

- Upstream: cycle 01 parent #32 for named Plan domain interfaces. New
  prescription fields should extend those interfaces rather than reintroducing
  `v.InferOutput` public types.
- Upstream: cycle 01 parent #35 for Plan-walking seams. Later association work
  should use the walker to find Week-level Prescribed Runs; this parent should
  not create a second Plan traversal abstraction.
- Downstream: Run association, lap comparison, formatter output, and history
  deltas consume the Prescribed Run and Prescribed Step structures created here.
- External: no new persistence layer, database, cache, workout-builder UI, or
  zone-history subsystem. `valibot` remains the runtime Plan parser unless a
  sub-issue proves a change is necessary.
- Tooling: use repository-defined commands only. Prior cycle closure found that
  a top-level `pnpm typecheck` script may not exist, so do not rely on it unless
  this parent adds or discovers one.

## Flags

- This parent resolves the cycle PRD's arrow-spelling question by accepting both
  ASCII `->` and Unicode `→` in authored Prescription Notation. Parsed output is
  the canonical ordered Prescribed Step sequence; stored Plans keep the runner's
  authored notation.
- Do not infer Target Ranges from Zone labels. A step can carry an intensity
  label for readability, but numeric comparison targets must come from inline
  Target Ranges when a metric is meant to be numerically comparable.
- Do not introduce reusable prescription templates in this parent. Prescribed
  Runs remain Block-specific instances owned by their Week for cycle 02.
- Do not add automatic interval detection or FIT lap logic here. Later parents
  compare Prescribed Steps to actual Segments derived from lap markers.
- If the parser design needs a hard-to-reverse public grammar decision beyond
  the v1 scope listed here, pause and consider an ADR before implementation.
