# Public API Audit Manifest (Sub-Issue #48)

## Section 1 - Chosen grouping shape

Chosen shape: **Alternative A (domain-led, glossary-aligned)**.

Top-level banners (in glossary order) and charters:

1. **Periodization** - APIs that define, validate, reconcile, inspect, and sync Plans, Weeks, and their execution semantics.
2. **Runs and capture** - APIs that discover and associate recorded Runs from FIT files to periodization context.
3. **Metrics and zones** - APIs centered on zones, threshold-derived metrics, and metric-band semantics.
4. **Analysis output** - APIs that execute Quantify and format the resulting analysis artifacts for consumers.
5. **Infrastructure** - APIs for config loading, output defaults, date/key transforms, and package runtime metadata.

Design-it-twice outcome and rejection rationale:

- **Alternative A (chosen):** Satisfies the cycle encounter constraint directly and keeps export placement tied to domain nouns in `context/ubiquitous-language.md`.
- **Alternative B (rejected):** Fails the hard constraint because layer names (configuration/ingestion/output) replace glossary-aligned domain banners.
- **Alternative C (rejected):** Preserves glossary top-level groupings but adds type/function sub-bands that increase visual noise without improving caller decisions.

## Section 2 - Export audit table

Verification basis for HIDE criteria:

- CLI consumer check from grep-derived import index over `packages/cli/src/**` for `@run2max/engine` imports.
- Engine test entrypoint check: no `@run2max/engine` imports found under `packages/engine/src/**/*.test.ts`.

| name | current source module | kind | classification | target banner | fold target | hide rationale |
| --- | --- | --- | --- | --- | --- | --- |
| ENGINE_VERSION | `./index.ts` | const | KEEP | Infrastructure | - | - |
| Run2MaxRecord | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| DataCapabilities | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| QuantifyOptions | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| AnalysisResult | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| RunSummary | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| SegmentRow | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| KmSplitRow | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| ZoneDistributionRow | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| DynamicsSummary | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| Anomaly | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| Run2MaxConfig | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| ZoneConfig | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| OutputProfileConfig | `./types.js` | type | KEEP | Infrastructure | - | - |
| ElevationProfile | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| WeatherSummary | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| WeatherPerSplit | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| PlanContext | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| detectCapabilities | `./detect-capabilities.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| loadConfig | `./config/loader.js` | function | KEEP | Infrastructure | - | - |
| LoadConfigOptions | `./config/loader.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| MicrocycleConfig | `./config/schema.js` | type | KEEP | Periodization | - | - |
| quantify | `./computations/quantify.js` | function | KEEP | Analysis output | - | - |
| classifyZone | `./computations/zones.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| classifyPowerZone | `./computations/zones.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeZoneDistribution | `./computations/zones.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeSegments | `./computations/segments.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeKmSplits | `./computations/km-splits.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeDynamicsSummary | `./computations/dynamics.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| aggregateBucket | `./computations/aggregate.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| WeightedRecord | `./computations/aggregate.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| AggregationConfig | `./computations/aggregate.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| AggregatedFields | `./computations/aggregate.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeSummary | `./computations/summary.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| detectAnomalies | `./computations/anomalies.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| applyAnomalyExclusions | `./computations/anomalies.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeElevationProfile | `./computations/elevation.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| computeNormalizedPower | `./computations/utils.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| formatResult | `./formatters/index.js` | function | KEEP | Analysis output | - | - |
| DEFAULT_PROFILE | `./formatters/index.js` | const | KEEP | Infrastructure | - | - |
| formatDefaultView | `./formatters/plan.js` | function | FOLD | - | `formatPlanStatus(status, { view: "default" })` - one formatter API with view option removes shallow split functions. | - |
| formatFullView | `./formatters/plan.js` | function | FOLD | - | `formatPlanStatus(status, { view: "full" })` - same surface as default view, with view chosen by options instead of separate export. | - |
| FormatResult | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| OutputFormat | `./types.js` | type | KEEP | Analysis output | - | - |
| SectionId | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| ColumnId | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| AnalysisMetadata | `./types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| parsePlan | `./plan/schema.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| PLANNED_WEEK_TYPES | `./plan/schema.js` | const | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| EXECUTED_ONLY_TYPES | `./plan/schema.js` | const | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| ALL_WEEK_TYPES | `./plan/schema.js` | const | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| REASON_CATEGORIES | `./plan/schema.js` | const | KEEP | Periodization | - | - |
| KNOWN_DISTANCES | `./plan/schema.js` | const | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| Plan | `./plan/types.js` | type | KEEP | Periodization | - | - |
| Mesocycle | `./plan/types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| Fractal | `./plan/types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| Week | `./plan/types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| TestingPeriod | `./plan/types.js` | type | KEEP | Periodization | - | - |
| validatePlan | `./plan/validate.js` | function | KEEP | Periodization | - | - |
| Diagnostic | `./plan/validate.js` | type | KEEP | Periodization | - | - |
| loadPlan | `./plan/loader.js` | function | KEEP | Periodization | - | - |
| loadUserTemplates | `./plan/loader.js` | function | FOLD | - | `resolvePlanTemplate(name, { userTemplatesDir })` - replaces the two-step load+resolve call pattern used by CLI create flow. | - |
| resolveTemplate | `./plan/loader.js` | function | FOLD | - | `resolvePlanTemplate(name, { userTemplatesDir })` - centralizes builtin+user lookup and unknown-template diagnostics in one entrypoint. | - |
| buildPlanFromTemplate | `./plan/build.js` | function | KEEP | Periodization | - | - |
| BuildPlanOptions | `./plan/build.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| addDays | `./plan/dates.js` | function | KEEP | Infrastructure | - | - |
| reconcile | `./plan/reconcile.js` | function | KEEP | Periodization | - | - |
| ReconcileOptions | `./plan/reconcile.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| ReconciliationResult | `./plan/reconcile.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| CompressionOption | `./plan/reconcile.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| getPlanStatus | `./plan/status.js` | function | KEEP | Periodization | - | - |
| PlanStatus | `./plan/status.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| WeekStatusEntry | `./plan/status.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| NextMilestone | `./plan/status.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| WeekMarker | `./plan/status.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| PlanStatusOptions | `./plan/status.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| detectWeekDeviations | `./plan/detect.js` | function | KEEP | Periodization | - | - |
| reportHasAnomalies | `./plan/detect.js` | function | KEEP | Periodization | - | - |
| DeviationReport | `./plan/detect.js` | type | KEEP | Periodization | - | - |
| WeekRun | `./plan/detect.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| syncWeek | `./plan/sync.js` | function | KEEP | Periodization | - | - |
| SyncError | `./plan/sync.js` | class | KEEP | Periodization | - | - |
| SyncData | `./plan/sync.js` | type | KEEP | Periodization | - | - |
| adjustPlan | `./plan/adjust.js` | function | KEEP | Periodization | - | - |
| AdjustError | `./plan/adjust.js` | class | KEEP | Periodization | - | - |
| AdjustOptions | `./plan/adjust.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| AdjustResult | `./plan/adjust.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| walkPlan | `./plan/walk.js` | function | KEEP | Periodization | - | - |
| WeekContext | `./plan/walk.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| associateRun | `./plan/associate.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| scanBlockRuns | `./plan/associate.js` | function | KEEP | Runs and capture | - | - |
| extractDisplayName | `./plan/associate.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| WeekAssociation | `./plan/associate.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| BlockRun | `./plan/associate.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| transformKeysSnakeToCamel | `./plan/case-keys.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| transformKeysCamelToSnake | `./plan/case-keys.js` | function | KEEP | Infrastructure | - | - |
| PlanTemplate | `./plan/templates/types.js` | type | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |
| BUILTIN_TEMPLATES | `./plan/templates/builtin.js` | const | FOLD | - | `listPlanTemplates({ userTemplatesDir })` - avoids direct constant coupling and returns the effective template catalog for UX listing. | - |
| getBuiltinTemplate | `./plan/templates/builtin.js` | function | HIDE | - | - | No `@run2max/engine` import found in `packages/cli/src/**` for this symbol (consumer index grep), and no engine test imports package entrypoint. |

## Section 3 - Count summary

- Total exports audited: **99**
- KEEP: **29** (meets parent criterion `<= 30`)
- FOLD: **5**
- HIDE: **65**

KEEP per banner:

- Periodization: **19**
- Runs and capture: **1**
- Metrics and zones: **0**
- Analysis output: **3**
- Infrastructure: **6**

FOLD deeper-API summary:

- Template resolution fold: `loadUserTemplates` + `resolveTemplate` (and direct `BUILTIN_TEMPLATES` exposure) converge toward an intent-level template access surface (`resolvePlanTemplate`, `listPlanTemplates`).
- Plan status formatting fold: `formatDefaultView` + `formatFullView` converge toward one formatter with an explicit view mode (`formatPlanStatus`).

## Section 4 - Cross-package consumer index

Derived from CLI imports in `packages/cli/src/**` from `@run2max/engine`.

| engine export | imported by CLI file(s) |
| --- | --- |
| AdjustError | `packages/cli/src/commands/plan/adjust.ts` |
| BUILTIN_TEMPLATES | `packages/cli/src/commands/plan/create.ts` |
| DEFAULT_PROFILE | `packages/cli/src/commands/quantify.ts` |
| DeviationReport | `packages/cli/src/commands/plan/status.ts` |
| Diagnostic | `packages/cli/src/commands/plan/validate.ts` |
| ENGINE_VERSION | `packages/cli/src/index.ts` |
| MicrocycleConfig | `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/quantify.ts` |
| OutputFormat | `packages/cli/src/commands/quantify.ts` |
| OutputProfileConfig | `packages/cli/src/commands/quantify.ts` |
| Plan | `packages/cli/src/commands/plan/adjust.ts`, `packages/cli/src/commands/plan/create.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/quantify.ts` |
| REASON_CATEGORIES | `packages/cli/src/commands/plan/sync.ts` |
| SyncData | `packages/cli/src/commands/plan/sync.ts` |
| SyncError | `packages/cli/src/commands/plan/sync.ts` |
| TestingPeriod | `packages/cli/src/commands/plan/sync.ts` |
| addDays | `packages/cli/src/commands/plan/status.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/quantify.ts` |
| adjustPlan | `packages/cli/src/commands/plan/adjust.ts` |
| buildPlanFromTemplate | `packages/cli/src/commands/plan/create.ts` |
| detectWeekDeviations | `packages/cli/src/commands/plan/status.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/quantify.ts` |
| formatDefaultView | `packages/cli/src/commands/plan/status.ts` |
| formatFullView | `packages/cli/src/commands/plan/adjust.ts`, `packages/cli/src/commands/plan/status.ts` |
| formatResult | `packages/cli/src/commands/quantify.ts` |
| getPlanStatus | `packages/cli/src/commands/plan/adjust.ts`, `packages/cli/src/commands/plan/status.ts`, `packages/cli/src/commands/plan/sync.ts` |
| loadConfig | `packages/cli/src/commands/plan/status.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/quantify.ts` |
| loadPlan | `packages/cli/src/commands/plan/adjust.ts`, `packages/cli/src/commands/plan/status.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/plan/validate.ts`, `packages/cli/src/commands/quantify.ts` |
| loadUserTemplates | `packages/cli/src/commands/plan/create.ts` |
| quantify | `packages/cli/src/commands/quantify.ts` |
| reconcile | `packages/cli/src/commands/plan/create.ts` |
| reportHasAnomalies | `packages/cli/src/commands/quantify.ts` |
| resolveTemplate | `packages/cli/src/commands/plan/create.ts` |
| scanBlockRuns | `packages/cli/src/commands/plan/status.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/quantify.ts` |
| syncWeek | `packages/cli/src/commands/plan/sync.ts` |
| transformKeysCamelToSnake | `packages/cli/src/commands/plan/create.ts` |
| validatePlan | `packages/cli/src/commands/plan/adjust.ts`, `packages/cli/src/commands/plan/create.ts`, `packages/cli/src/commands/plan/sync.ts`, `packages/cli/src/commands/plan/validate.ts` |
| walkPlan | `packages/cli/src/commands/plan/create.ts`, `packages/cli/src/commands/quantify.ts` |

## Section 5 - Open questions for follow-on sub-issues

1. **Template API fold design (candidate #50):** Define and migrate to `resolvePlanTemplate` and `listPlanTemplates`, then remove direct `BUILTIN_TEMPLATES` exposure and two-step lookup in CLI create flow.
2. **Plan status formatter consolidation (candidate #51):** Introduce `formatPlanStatus(status, { view })`, migrate callers from `formatDefaultView`/`formatFullView`, then collapse the split API.
3. **Apply manifest mechanically (candidate #49):** Rewrite `packages/engine/src/index.ts` by this audit, update CLI imports in the same PR, and verify command behavior/tests unchanged.
