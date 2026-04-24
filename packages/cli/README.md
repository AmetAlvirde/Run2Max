# @run2max/cli

CLI for run2max. Parses a `.fit` file and produces a structured run analysis as
markdown, JSON, or YAML.

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

Reads config from `~/.config/run2max/config.yaml` automatically, fetches
weather from Open-Meteo when GPS is present, and writes markdown to stdout.

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

| Flag                  | Short | Default | Description |
|-----------------------|-------|---------|-------------|
| `--workout`           | `-w`  | —       | Workout name |
| `--block`             | `-b`  | —       | Training block label |
| `--rpe`               | —     | —       | Rating of Perceived Exertion (number) |
| `--notes`             | `-n`  | —       | Free-text notes |
| `--format`            | `-f`  | `md`    | Output format: `md`, `json`, `yaml` |
| `--profile`           | `-p`  | —       | Output profile from config |
| `--output`            | `-o`  | —       | Write to file instead of stdout |
| `--timezone`          | `-t`  | —       | IANA timezone override |
| `--downsample`        | `-d`  | —       | Downsample interval in seconds (min 2) |
| `--config`            | `-c`  | —       | Explicit config file path |
| `--exclude-anomalies` | —     | `false` | Exclude anomalous values from aggregations |
| `--no-weather`        | —     | `false` | Skip weather fetch for this run |

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

power_zones:                                        # required
  - { label: "E",      name: "Easy",      min: 204, max: 233, rpe: "2-4" }
  - { label: "M",      name: "Marathon",  min: 251, max: 260, rpe: "5-6" }
  - { label: "THRESH", name: "Threshold", min: 289, max: 301, rpe: "7-8" }

hr_zones:                                           # optional
  - { label: "Z1", name: "Recovery",  min: 0,   max: 139 }
  - { label: "Z2", name: "Aerobic",   min: 140, max: 159 }
  - { label: "Z3", name: "Threshold", min: 160, max: 175 }

pace_zones:                                         # optional, values in sec/km
  - { label: "E", name: "Easy",     min: 360, max: 420 }
  - { label: "M", name: "Marathon", min: 300, max: 330 }

weather: true                                       # optional, default true

athlete:
  timezone: "America/Santiago"

output:
  default:
    sections: [summary, elevation_profile, weather, km_splits, zones, dynamics, anomalies, metadata]
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

| Column(s) | Requires |
|---|---|
| `power`, `zone`, `pace`, `hr`, `cadence` | Tier 1 (universal) |
| `elev_gain`, `elev_loss` | Tier 1 — altitude data in file |
| `gct`, `gct_balance`, `stride`, `vo`, `vo_balance`, `vr` | Tier 2 — Running Dynamics |
| `fpr`, `air_power` | Tier 3 — Stryd-enhanced |
| `wind`, `temp` | Weather API |

Columns requiring unavailable data are dropped with a warning to stderr.

**`skip_segments_if_single_lap`** — omits the segments section when the file
has only one lap.
