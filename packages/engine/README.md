# @run2max/engine

Core analysis library for run2max. Parses `.fit` data, detects available data
tiers, loads config, and produces a structured `AnalysisResult`.

## Public API

```ts
import {
  quantify,
  formatResult,
  loadConfig,
  detectCapabilities,
  classifyZone,
  computeElevationProfile,
  computeNormalizedPower,
} from "@run2max/engine";
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
  ElevationProfile,
  WeatherSummary,
  WeatherPerSplit,
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
`metadata`. Columns: `all`. `skipSegmentsIfSingleLap: true`.

Warnings are returned (not thrown) for dropped columns or skipped sections.

**All sections:** `summary` · `elevation_profile` · `weather` · `segments` ·
`km_splits` · `zones` · `hr_zones` · `pace_zones` · `dynamics` · `anomalies` ·
`metadata`

**All columns and requirements:**

| Column(s)                                                | Requires                                      |
| -------------------------------------------------------- | --------------------------------------------- |
| `power`, `zone`, `pace`, `hr`, `cadence`                 | Tier 1 (universal)                            |
| `elev_gain`, `elev_loss`                                 | Tier 1 — altitude data in file                |
| `gct`, `gct_balance`, `stride`, `vo`, `vo_balance`, `vr` | Tier 2 — Running Dynamics                     |
| `fpr`, `air_power`                                       | Tier 3 — Stryd-enhanced                       |
| `wind`, `temp`                                           | Weather API (skipped silently if unavailable) |

### `detectCapabilities(records)`

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
        km_splits,
        zones,
        dynamics,
        anomalies,
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
