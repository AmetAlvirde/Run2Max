# @run2max/engine

Core analysis library for run2max. Parses normalized `.fit` data, detects
available data tiers, loads config, and produces a structured `AnalysisResult`.

## Public API

```ts
import { quantify, formatResult, loadConfig, detectCapabilities } from "@run2max/engine";
import type {
  AnalysisResult,
  AnalysisMetadata,
  FormatResult,
  OutputFormat,
  OutputProfileConfig,
  SectionId,
  ColumnId,
  Run2MaxConfig,
  DataCapabilities,
} from "@run2max/engine";
```

### `quantify(fitBuffer, options?)`

Main entry point. Takes a raw `.fit` file as `ArrayBuffer` and returns an
`AnalysisResult`.

```ts
const result = await quantify(buffer, {
  config, // loaded via loadConfig()
  workout: "Build 17: Recovery Run",
  block: "Build Week 04",
  rpe: 2,
  timezone: "America/Santiago",
  excludeAnomalies: false,
});
```

`AnalysisResult` always includes a `metadata` field (`version`, `downsample`, `anomaliesExcluded`) populated from the options passed to `quantify()`.

### `loadConfig(options?)`

Discovers, merges, and validates the config. Returns `null` if no config file is
found.

```ts
const config = await loadConfig(); // auto-discover
const config = await loadConfig({ configPath: "./my-config.yaml" }); // explicit
```

Resolution order (highest priority last):

1. `~/.config/run2max/config.yaml`
2. `./run2max.config.yaml` (CWD)
3. `options.configPath` (bypasses auto-discovery)

When both 1 and 2 exist, they are deep-merged: object fields merge, arrays
replace.

### `formatResult(result, format, profile)`

Transforms an `AnalysisResult` into a formatted string. Returns `{ output, warnings }`.

```ts
import { formatResult, DEFAULT_PROFILE } from "@run2max/engine";

const { output, warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
// format: "markdown" | "json" | "yaml"
```

`DEFAULT_PROFILE` includes all sections and columns with `skipSegmentsIfSingleLap: false`.
Pass a custom `OutputProfileConfig` to filter sections, restrict columns, or enable single-lap skipping.

Warnings are returned (not thrown) when columns are dropped because the required data tier is
unavailable, or when `skipSegmentsIfSingleLap` removes the segments section.

**Sections:** `summary` · `segments` · `km_splits` · `zones` · `dynamics` · `anomalies`

**Columns:** `power` · `zone` · `pace` · `hr` · `cadence` · `gct` · `gct_balance` · `stride` · `vo` · `vo_balance` · `fpr` · `vr`

Column availability by tier:

| Column(s) | Requires |
|-----------|----------|
| `gct`, `gct_balance`, `stride`, `vo`, `vo_balance`, `vr` | Tier 2 — Running Dynamics |
| `fpr` | Tier 3 — Stryd-enhanced |

### `detectCapabilities(records)`

Scans all records and returns which data tiers are present.

```ts
const { hasRunningDynamics, hasStrydEnhanced } = detectCapabilities(records);
```

## Data tiers

| Tier                 | Fields                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| 1 — Universal        | `timestamp`, `power`, `heartRate`, `cadence`, `speed`, `distance`, `altitude`, GPS                     |
| 2 — Running Dynamics | `stanceTime`, `stanceTimeBalance`, `stepLength`, `verticalOscillation`, `verticalOscillationBalance`   |
| 3 — Stryd-enhanced   | `formPower`, `airPower`, `legSpringStiffness`, `legSpringStiffnessBalance`, `impactLoadingRateBalance` |

## Config format

```yaml
# ~/.config/run2max/config.yaml

calibration:
  date: "2026-02-01"
  source: "RECON block"
  critical_power: 295
  lthr: 171

zones:
  - { label: "E", name: "Easy", min: 204, max: 233, rpe: "2-4" }
  - { label: "M", name: "Marathon", min: 251, max: 260, rpe: "5-6" }
  - { label: "SS", name: "Sweet Spot", min: 260, max: 269, rpe: "6" }
  - { label: "HM", name: "Half Marathon", min: 269, max: 280, rpe: "6-7" }
  - { label: "SUB-T", name: "Sub-Threshold", min: 280, max: 289, rpe: "7" }
  - { label: "THRESH", name: "Threshold", min: 289, max: 301, rpe: "7-8" }

thresholds:
  lthr: 171
  max_hr: 192

athlete:
  timezone: "America/Santiago"

output:
  default:
    sections: [summary, km_splits, zones, dynamics, anomalies]
    columns: [power, zone, pace, hr, cadence, gct, stride]
    skip_segments_if_single_lap: true
  detailed:
    sections: [summary, segments, km_splits, zones, dynamics, anomalies]
    columns: all
    skip_segments_if_single_lap: false
```

Only `zones` is required. All other fields are optional.

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
