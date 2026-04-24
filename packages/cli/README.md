# @run2max/cli

CLI for run2max. Parses a Stryd `.fit` file and produces a structured analysis
as markdown, JSON, or YAML.

## Installation

```bash
pnpm install
pnpm build
```

The `run2max` binary is available at `packages/cli/dist/index.js`. Link it
globally with:

```bash
pnpm --filter @run2max/cli link --global
```

## Usage

```bash
run2max quantify <file.fit> [options]
```

### Basic

```bash
run2max quantify my-run.fit
```

Reads config from `~/.config/run2max/config.yaml` automatically and writes
markdown to stdout.

### With context metadata

```bash
run2max quantify my-run.fit \
  --workout "Build 17: Recovery Run" \
  --block "Build Week 04" \
  --rpe 2 \
  --notes "Felt easy throughout."
```

### Output format

```bash
run2max quantify my-run.fit --format md      # default: structured markdown
run2max quantify my-run.fit --format json
run2max quantify my-run.fit --format yaml
```

### Output profile

Profiles are defined in your config file (see below). The `default` profile is
used automatically if one is configured.

```bash
run2max quantify my-run.fit --profile detailed
```

### Write to file

```bash
run2max quantify my-run.fit --output analysis.md
run2max quantify my-run.fit --format json --output analysis.json
```

### Timezone override

```bash
run2max quantify my-run.fit --timezone America/Santiago
```

Overrides both the config timezone and whatever timezone is embedded in the
`.fit` file.

### Downsampling

```bash
run2max quantify my-run.fit --downsample 10   # 1 record per 10 seconds
```

Reduces record density before all computations. Minimum value is 2.

### Anomaly handling

```bash
run2max quantify my-run.fit --exclude-anomalies
```

By default, anomalies (HR=0, LSS=0 clusters) are detected and noted in the
output but included in all calculations. With `--exclude-anomalies`, affected
field values are nulled out and excluded from aggregations.

### Explicit config file

```bash
run2max quantify my-run.fit --config ./run2max.config.yaml
```

Bypasses the auto-discovery order and uses the specified file directly.

## All flags

| Flag                  | Short | Default | Description                                |
| --------------------- | ----- | ------- | ------------------------------------------ |
| `--workout`           | `-w`  | —       | Workout name                               |
| `--block`             | `-b`  | —       | Training block label                       |
| `--rpe`               | —     | —       | Rating of Perceived Exertion (number)      |
| `--notes`             | `-n`  | —       | Free-text notes                            |
| `--format`            | `-f`  | `md`    | Output format: `md`, `json`, `yaml`        |
| `--profile`           | `-p`  | —       | Output profile from config                 |
| `--output`            | `-o`  | —       | Write to file instead of stdout            |
| `--timezone`          | `-t`  | —       | IANA timezone override                     |
| `--downsample`        | `-d`  | —       | Downsample interval in seconds (min 2)     |
| `--config`            | `-c`  | —       | Explicit config file path                  |
| `--exclude-anomalies` | —     | `false` | Exclude anomalous values from aggregations |

## Config

The CLI reads config automatically — no flag needed. Resolution order (highest
priority last):

1. `~/.config/run2max/config.yaml`
2. `./run2max.config.yaml` (current working directory)
3. `--config <path>` (bypasses auto-discovery)

When both 1 and 2 exist they are deep-merged: object fields merge, arrays
replace.

### Config format

```yaml
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

If no config file is found, zone analysis is unavailable and a warning is
printed to stderr. The rest of the output (km splits, dynamics, anomalies)
is still produced.

### Output profiles

A profile controls which sections and columns appear in the output.

**`sections`** — any subset of: `summary`, `segments`, `km_splits`, `zones`,
`dynamics`, `anomalies`

**`columns`** — any subset of the columns below, or `all`:

| Column                                                   | Requires                  |
| -------------------------------------------------------- | ------------------------- |
| `power`, `zone`, `pace`, `hr`, `cadence`                 | Tier 1 (universal)        |
| `gct`, `gct_balance`, `stride`, `vo`, `vo_balance`, `vr` | Tier 2 — Running Dynamics |
| `fpr`                                                    | Tier 3 — Stryd-enhanced   |

Columns that require a data tier not present in the `.fit` file are silently
dropped with a warning printed to stderr.

**`skip_segments_if_single_lap`** — when `true`, the segments section is
omitted if the file has only one lap. Useful for the default profile to avoid a
redundant one-row table.
