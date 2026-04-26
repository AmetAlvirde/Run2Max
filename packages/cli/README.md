# @run2max/cli

CLI for run2max. Parses `.fit` files into structured run analysis and manages
training plan files.

## Installation

```bash
pnpm install
pnpm build
```

Link globally:

```bash
pnpm --filter @run2max/cli link --global
```

## Usage

```bash
run2max quantify <file.fit> [options]
```

Reads config from `~/.config/run2max/config.yaml` automatically, fetches weather
from Open-Meteo when GPS is present, and writes markdown to stdout.

### Context metadata

```bash
run2max quantify my-run.fit \
  --workout "Build 17: Recovery Run" \
  --block   "Build Week 04" \
  --rpe     2 \
  --notes   "Felt easy throughout."
```

### Output format and profile

```bash
run2max quantify my-run.fit --format json          # md (default), json, yaml
run2max quantify my-run.fit --profile detailed     # profile from config
run2max quantify my-run.fit --output analysis.md   # write to file
```

### Weather

Weather is fetched automatically when GPS coordinates are in the file. Disable
it permanently with `weather: false` in config, or per-run with:

```bash
run2max quantify my-run.fit --no-weather
```

### Other flags

```bash
run2max quantify my-run.fit --timezone America/Santiago   # IANA tz override
run2max quantify my-run.fit --downsample 10               # 1 record per 10s
run2max quantify my-run.fit --exclude-anomalies           # null out bad values
run2max quantify my-run.fit --config ./run2max.config.yaml
```

## All flags

| Flag                  | Short | Default | Description                                                                                         |
| --------------------- | ----- | ------- | --------------------------------------------------------------------------------------------------- |
| `--workout`           | `-w`  | —       | Workout name                                                                                        |
| `--block`             | `-b`  | —       | Training block label                                                                                |
| `--rpe`               | —     | —       | Rating of Perceived Exertion (number)                                                               |
| `--notes`             | `-n`  | —       | Free-text notes                                                                                     |
| `--format`            | `-f`  | `md`    | Output format: `md`, `json`, `yaml`                                                                 |
| `--profile`           | `-p`  | —       | Output profile from config                                                                          |
| `--output`            | `-o`  | —       | Write to file instead of stdout                                                                     |
| `--timezone`          | `-t`  | —       | IANA timezone override                                                                              |
| `--downsample`        | `-d`  | —       | Downsample interval in seconds (min 2)                                                              |
| `--config`            | `-c`  | —       | Explicit config file path                                                                           |
| `--exclude-anomalies` | —     | `false` | Exclude anomalous values from aggregations                                                          |
| `--no-weather`        | —     | `false` | Skip weather fetch for this run                                                                     |
| `--plan`              | —     | —       | Path to `plan.yaml` or its directory (auto-discovered from the `.fit` file's directory when absent) |

## Plan commands

### `plan create`

```bash
run2max plan create --template <name> --block <label> --start <YYYY-MM-DD> [options]
```

Creates a `plan.yaml` from a built-in or user-defined template.

| Flag          | Required | Description                                                                  |
| ------------- | -------- | ---------------------------------------------------------------------------- |
| `--template`  | yes      | Template name                                                                |
| `--block`     | yes      | Training block label                                                         |
| `--start`     | yes      | Start date (must fall on configured `week_start` day)                        |
| `--goal`      | no       | Race or goal description                                                     |
| `--distance`  | no       | Race distance (`5k`, `10k`, `half-marathon`, `marathon`)                     |
| `--race-date` | no       | Race date (YYYY-MM-DD)                                                       |
| `--strategy`  | no       | Compression strategy (e.g. `shorten-taper`, `shorten-taper+shorten-fractal`) |
| `--dir`       | no       | Output directory (defaults to CWD)                                           |
| `--force`     | no       | Overwrite existing `plan.yaml`                                               |

### `plan status`

```bash
run2max plan status [--full] [--dir <path>] [--config <path>]
```

Shows the current week's focus. `--full` shows the entire block overview.
Detects and reports deviations for unsynced past weeks when microcycle config is
available.

### `plan sync`

```bash
run2max plan sync [--week <n>] [--executed <type>] [options]
```

Records execution for a week. When `--week` and `--executed` are omitted the
command runs interactively.

| Flag         | Description                                           |
| ------------ | ----------------------------------------------------- |
| `--week`     | Absolute 1-based week number                          |
| `--executed` | Executed week type (`D`, `INC`, `DNF`, `Ta`, …)       |
| `--reason`   | Deviation reason (required with `INC` or `DNF`)       |
| `--note`     | Free-text note                                        |
| `--cp`       | Critical power result in watts (test weeks only)      |
| `--eftp`     | eFTP from Intervals.icu in watts (test weeks only)    |
| `--lthr`     | Lactate threshold heart rate in bpm (test weeks only) |
| `--dir`      | Directory containing `plan.yaml`                      |
| `--config`   | Explicit config file path                             |

### `plan adjust`

```bash
run2max plan adjust [--race-date <YYYY-MM-DD>] [--strategy <name>] [--yes]
```

Restructures future weeks. Use when the race date changes or to apply a
compression strategy without changing the date.

Strategies: `shorten-taper` · `reduce-transition` · `shorten-fractal` ·
`reduce-testing` · `skip-testing` · `drop-fractal`

`--yes` skips the confirmation prompt (useful for scripting).

### `plan validate`

```bash
run2max plan validate [plan.yaml]
```

Validates a `plan.yaml` file — structure (schema) and semantics (e.g. no
executed-only types in the `planned` field, no `testingPeriod` on DNF weeks).

Defaults to `./plan.yaml` in the current directory. Pass a path to validate a
specific file.

**Output:** `error: <message> (<path>)` lines, then a summary (`2 errors`).
Prints `plan.yaml is valid` on success.

**Exit codes:** `0` on success, `1` on errors.

## Config

Resolution order (highest priority last):

1. `~/.config/run2max/config.yaml`
2. `./run2max.config.yaml` (CWD)
3. `--config <path>` (bypasses auto-discovery)

When both 1 and 2 exist they are deep-merged: object fields merge, arrays
replace.

If no config is found, zone analysis is unavailable and a warning is printed to
stderr. Everything else (splits, dynamics, anomalies) is still produced.

### Config format

```yaml
calibration:
  date: "2026-02-01"
  source: "RECON block"
  critical_power: 295
  lthr: 171

power_zones: # required
  - { label: "E", name: "Easy", min: 204, max: 233, rpe: "2-4" }
  - { label: "M", name: "Marathon", min: 251, max: 260, rpe: "5-6" }
  - { label: "THRESH", name: "Threshold", min: 289, max: 301, rpe: "7-8" }

hr_zones: # optional
  - { label: "Z1", name: "Recovery", min: 0, max: 139 }
  - { label: "Z2", name: "Aerobic", min: 140, max: 159 }
  - { label: "Z3", name: "Threshold", min: 160, max: 175 }

pace_zones: # optional, values in sec/km
  - { label: "E", name: "Easy", min: 360, max: 420 }
  - { label: "M", name: "Marathon", min: 300, max: 330 }

weather: true # optional, default true

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

`power_zones` is the only required field.

### Output profiles

A profile controls which sections and columns appear in the output.

**Sections:** `summary` · `elevation_profile` · `weather` · `segments` ·
`km_splits` · `zones` · `hr_zones` · `pace_zones` · `dynamics` · `anomalies` ·
`metadata`

**Columns and requirements:**

| Column(s)                                                | Requires                       |
| -------------------------------------------------------- | ------------------------------ |
| `power`, `zone`, `pace`, `hr`, `cadence`                 | Tier 1 (universal)             |
| `elev_gain`, `elev_loss`                                 | Tier 1 — altitude data in file |
| `gct`, `gct_balance`, `stride`, `vo`, `vo_balance`, `vr` | Tier 2 — Running Dynamics      |
| `fpr`, `air_power`                                       | Tier 3 — Stryd-enhanced        |
| `wind`, `temp`                                           | Weather API                    |

Columns requiring unavailable data are dropped with a warning to stderr.

**`skip_segments_if_single_lap`** — omits the segments section when the file has
only one lap.
