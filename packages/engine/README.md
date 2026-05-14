# @run2max/engine

Core analysis library for run2max. Parses `.fit` data, detects available data
tiers, loads config, and produces a structured `AnalysisResult`.

## Public API

```ts
import {
  ENGINE_VERSION,
  // analysis output
  quantify,
  formatResult,
  formatPlanStatus,
  DEFAULT_PROFILE,
  // config and infrastructure
  loadConfig,
  addDays,
  transformKeysCamelToSnake,
  // periodization and plan flow
  REASON_CATEGORIES,
  loadPlan,
  parsePrescriptionNotation,
  PrescriptionNotationError,
  resolvePlanTemplate,
  listPlanTemplates,
  buildPlanFromTemplate,
  reconcile,
  getPlanStatus,
  detectWeekDeviations,
  reportHasAnomalies,
  syncWeek,
  SyncError,
  adjustPlan,
  AdjustError,
  walkPlan,
  readHistoryArtifacts,
  // run association
  scanBlockRuns,
  findPrescribedRun,
  PrescribedRunOverrideError,
  validatePlan,
  comparePrescriptionToSegments,
  computeComparableHistoryDelta,
} from "@run2max/engine";
import type {
  OutputFormat,
  OutputProfileConfig,
  MicrocycleConfig,
  Plan,
  PrescribedRun,
  PrescribedStep,
  PrescriptionDiagnostic,
  PrescriptionComparison,
  ComparableHistory,
  HistoryArtifactReport,
  FindPrescribedRunResult,
  TestingPeriod,
  Diagnostic,
  DeviationReport,
  SyncData,
} from "@run2max/engine";
```

The public surface includes the core `quantify` pipeline plus selected plan,
association, prescription-comparison, and comparable-history helpers that are
stable enough for CLI and other access-surface consumers.

### `quantify(fitBuffer, options?)`

Main entry point. Takes a raw `.fit` file as `ArrayBuffer` and returns an
`AnalysisResult`.

```ts
const result = await quantify(buffer, {
  config, // loaded via loadConfig()
  workout: "Build 17: Recovery Run",
  block: "Build Week 04",
  rpe: 2,
  notes: "Felt easy throughout.",
  timezone: "America/Santiago",
  downsample: 5, // 1 record per 5s
  excludeAnomalies: false,
  noWeather: false, // true to skip weather fetch
});
```

Weather is fetched automatically from Open-Meteo when GPS coordinates are
present in the file and `config.weather` is not `false`. Pass `noWeather: true`
or set `weather: false` in config to disable.

`AnalysisResult` includes:

| Field                  | Description                                                                    |
| ---------------------- | ------------------------------------------------------------------------------ |
| `metadata`             | `version`, `downsample`, `anomaliesExcluded`, `fileSampleRate`                 |
| `summary`              | Full run summary including max values, elevation stats, NP/IF/RSS, zone labels |
| `segments`             | Per-lap rows                                                                   |
| `kmSplits`             | Per-km rows                                                                    |
| `zoneDistribution`     | Power zone time distribution                                                   |
| `hrZoneDistribution`   | HR zone time distribution (empty if not configured)                            |
| `paceZoneDistribution` | Pace zone time distribution (empty if not configured)                          |
| `dynamicsSummary`      | Running dynamics averages (null if no Tier 2/3 data)                           |
| `elevationProfile`     | Ascent/descent/chart points (null if no altitude data)                         |
| `weatherSummary`       | Temperature, humidity, wind, conditions (null if unavailable)                  |
| `weatherPerSplit`      | Hourly weather interpolated per km split                                       |
| `anomalies`            | Detected anomalies                                                             |
| `capabilities`         | `hasRunningDynamics`, `hasStrydEnhanced`                                       |
| `planContext`          | Plan week context when a Plan is loaded (always forwarded, not profile-gated)  |
| `prescribedRunContext` | Matched Prescribed Run metadata when association succeeds                      |
| `prescriptionComparison` | Single-Run Prescription Comparison when matched; available comparisons may include Comparable-History Deltas |

### `loadConfig(options?)`

Discovers, merges, and validates the config. Returns `null` if no config file is
found.

```ts
const config = await loadConfig(); // auto-discover
const config = await loadConfig({ configPath: "./my.yaml" }); // explicit
```

Resolution order (highest priority last):

1. `~/.config/run2max/config.yaml`
2. `./run2max.config.yaml` (CWD)
3. `options.configPath` (bypasses auto-discovery)

When both 1 and 2 exist, they are deep-merged: object fields merge, arrays
replace.

### `formatResult(result, format, profile)`

Transforms an `AnalysisResult` into a formatted string. Returns
`{ output, warnings }`.

```ts
import { formatResult, DEFAULT_PROFILE } from "@run2max/engine";

const { output, warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
// format: "markdown" | "json" | "yaml"
```

`DEFAULT_PROFILE` sections (in order): `summary` · `elevation_profile` ·
`weather` · `segments` · `km_splits` · `zones` · `dynamics` · `anomalies` ·
`prescription_comparison` · `metadata`. Columns: `all`. `skipSegmentsIfSingleLap: true`.

Warnings are returned (not thrown) for dropped columns or skipped sections.

### `formatPlanStatus(status, { view })`

Renders plan status text from a `PlanStatus`.

```ts
const status = getPlanStatus(plan);
const defaultView = formatPlanStatus(status, { view: "default" });
const fullView = formatPlanStatus(status, { view: "full" });
```

`view` is required and must be either `"default"` or `"full"`.

**All sections:** `summary` · `elevation_profile` · `weather` · `segments` ·
`km_splits` · `zones` · `hr_zones` · `pace_zones` · `dynamics` · `anomalies` ·
`prescription_comparison` · `metadata`

**All columns and requirements:**

| Column(s)                                                | Requires                                      |
| -------------------------------------------------------- | --------------------------------------------- |
| `power`, `zone`, `pace`, `hr`, `cadence`                 | Tier 1 (universal)                            |
| `elev_gain`, `elev_loss`                                 | Tier 1 — altitude data in file                |
| `gct`, `gct_balance`, `stride`, `vo`, `vo_balance`, `vr` | Tier 2 — Running Dynamics                     |
| `fpr`, `air_power`                                       | Tier 3 — Stryd-enhanced                       |
| `wind`, `temp`                                           | Weather API (skipped silently if unavailable) |

### `loadPlan(filePath)`

Reads a `plan.yaml` from disk, transforms snake_case keys to camelCase, and
parses it against the plan schema. Throws with a descriptive message on missing
file, invalid YAML, schema failure, or invalid Prescription Notation. Invalid
Prescription Notation is reported as `PrescriptionNotationError` with structured
diagnostics and file-path context.

```ts
const plan = await loadPlan("./plan.yaml");
```

### Prescription Notation and Prescribed Runs

Plans may define optional `prescribed_runs` under each Week. `loadPlan` expands
each authored prescription into ordered `PrescribedStep[]` values on the parsed
Plan.

```yaml
prescribed_runs:
  - local_date: "2026-05-12"
    label: "Tuesday Intervals"
    comparison_group: "sub-threshold-3min"
    prescription: "1.6K @ E -> 4(3min @ SUB-T[260-280W]/1min @ E) -> 1.6K @ E"
```

`parsePrescriptionNotation` supports v1 distance and duration steps, repeated
groups, ASCII `->` and Unicode `→` separators, intensity labels, and inline power
Target Ranges. Production Plan loading requires Target Ranges for numerically
comparable labels and uses `E`, `LR`, and `REC` as the v1 non-comparable label
set. Repetition count is capped at 50.

### Prescribed Run Association and Comparison

`findPrescribedRun` matches a captured Run to a Prescribed Run by local date by
default, or by explicit override date/label. `quantify` throws
`PrescribedRunOverrideError` when an explicit override fails; default association
misses remain non-fatal.

When association succeeds, `quantify` compares lap-derived Segment rows to the
Prescribed Steps by order. The result is available when usable laps match the
prescription step count, otherwise it reports a structured unavailable reason.

### Comparable History

`readHistoryArtifacts` discovers prior detailed YAML/JSON Analysis Artifacts in
the same Block directory, paired to FIT files by basename and filtered to the
same Comparison Group. FIT extension matching is case-insensitive, so the current
Run is excluded even when the file is named with `.FIT` or mixed-case `.FiT`.

`computeComparableHistoryDelta` compares available current and prior evidence for
avg power, avg/max heart rate, avg pace, and run-level RPE. These deltas are
attached under `prescriptionComparison.comparableHistory` when available.

### `resolvePlanTemplate(name, options?)`

Resolves a template by name from built-in templates and optional user templates
directory.

```ts
const template = await resolvePlanTemplate("10k", {
  userTemplatesDir: "~/.config/run2max/templates",
});
```

### `listPlanTemplates(options?)`

Returns the effective template catalog (built-ins plus optional user templates).

```ts
const templates = await listPlanTemplates({
  userTemplatesDir: "~/.config/run2max/templates",
});
```

### `validatePlan(plan)`

Runs semantic checks on a parsed `Plan` and returns `Diagnostic[]`. An empty
array means the plan is semantically valid.

```ts
const diagnostics = validatePlan(plan);
// [{ code: "EXECUTED_ONLY_AS_PLANNED", message: "...", path: "..." }]
```

Checks performed: executed-only types used as `planned`, `reason` without a
deviation, `testingPeriod` on non-test or DNF weeks, CP recorded when Ta was
DNF or INC without test results.

### `getPlanStatus(plan, today?, options?)`

Builds structural status data for current-week and full-block views.

### `detectWeekDeviations(weekRuns, microcycleConfig, plannedType)`

Computes deviation signals for one week, including anomaly markers surfaced by
plan status renderers.

### `syncWeek(plan, args)` / `adjustPlan(plan, options)`

Plan mutation helpers used by `plan sync` and `plan adjust` command flows.

### `walkPlan(plan)`

Returns an eager `WeekContext[]` traversal over the full Plan.

### `scanBlockRuns(dir)`

Scans a Block directory and returns `.fit` run records for association and
deviation checks.

## Data tiers

| Tier                 | Fields                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| 1 — Universal        | `timestamp`, `power`, `heartRate`, `cadence`, `speed`, `distance`, `altitude`, GPS                     |
| 2 — Running Dynamics | `stanceTime`, `stanceTimeBalance`, `stepLength`, `verticalOscillation`, `verticalOscillationBalance`   |
| 3 — Stryd-enhanced   | `formPower`, `airPower`, `legSpringStiffness`, `legSpringStiffnessBalance`, `impactLoadingRateBalance` |

## Config format

Config keys are snake_case in YAML and camelCase in TypeScript.

```yaml
# ~/.config/run2max/config.yaml

calibration:
  date: "2026-02-01"
  source: "RECON block"
  critical_power: 295
  lthr: 171

power_zones: # required
  - { label: "E", name: "Easy", min: 204, max: 233, rpe: "2-4" }
  - { label: "M", name: "Marathon", min: 251, max: 260, rpe: "5-6" }
  - { label: "SS", name: "Sweet Spot", min: 261, max: 270, rpe: "6" }
  - { label: "HM", name: "Half Marathon", min: 271, max: 280, rpe: "6-7" }
  - { label: "SUB-T", name: "Sub-Threshold", min: 281, max: 290, rpe: "7" }
  - { label: "THRESH", name: "Threshold", min: 291, max: 301, rpe: "7-8" }

hr_zones: # optional
  - { label: "Z1", name: "Recovery", min: 0, max: 139 }
  - { label: "Z2", name: "Aerobic", min: 140, max: 159 }
  - { label: "Z3", name: "Threshold", min: 160, max: 175 }

pace_zones: # optional, values in sec/km
  - { label: "E", name: "Easy", min: 360, max: 420 }
  - { label: "M", name: "Marathon", min: 300, max: 330 }

weather: true # optional, default true

thresholds:
  lthr: 171
  max_hr: 192

athlete:
  timezone: "America/Santiago"

output:
  default:
    sections:
      [
        summary,
        elevation_profile,
        weather,
        segments,
        km_splits,
        zones,
        dynamics,
        anomalies,
        prescription_comparison,
        metadata,
      ]
    columns: [power, zone, pace, hr, cadence, elev_gain, elev_loss, wind, temp]
    skip_segments_if_single_lap: true
  detailed:
    sections: all
    columns: all
    skip_segments_if_single_lap: false
```

`power_zones` is the only required field. All others are optional.

## Testing

```bash
# Unit tests only
pnpm --filter @run2max/engine exec vitest run

# With smoke tests against a real .fit file
FIT_FIXTURE=./fixture-fits/your-run.fit pnpm --filter @run2max/engine exec vitest run
```

### Known gap: Tier 1-only smoke test

The smoke tests assume a Stryd `.fit` file (Tier 2 + Tier 3 data present).
A smoke test that exercises the full pipeline with a Tier 1-only file (no
running dynamics, no Stryd fields) is pending — waiting on a `.fit` file from
a non-Stryd device. Until then, tier degradation is covered at the unit level
by `detect-capabilities.test.ts`.
