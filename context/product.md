# Run2Max

> Durable product identity. Cycle-specific scope lives in
> `context/cycles/XX-name/`. Domain terms live in `ubiquitous-language.md`.

## Elevator pitch

Run2Max is a power-based running analysis tool for runners who already train
seriously and already own the data — Garmin `.fit` files, Stryd footpod,
custom zones, periodized plans — but currently scatter that data across
Garmin Connect, Stryd PowerCenter, spreadsheets, and notebooks. Run2Max
re-centers it: one CLI that ingests a `.fit` file, attaches periodization
context, computes the metrics the runner actually trains by (CP, NP, IF, RSS,
zone distributions, running dynamics), and treats the training plan as a
first-class artifact under version control.

## Intentions

- Treat the runner's own files as the source of truth — `.fit` files in, no
  cloud lock-in, no proprietary store.
- Make periodization a first-class object in the system, not a label on a row
  in someone else's database.
- Keep the analysis honest about what the data actually supports: Tier 1 / 2 /
  3 capabilities are explicit, anomalies are flagged, missing fields degrade
  gracefully rather than silently fabricate.
- Stay framework-agnostic at the engine boundary so the same logic can serve
  CLI, future web, future mobile, or future automation surfaces without rewrite.

## Goals

- A single CLI that turns a `.fit` file plus an optional `plan.yaml` into a
  structured analysis result the runner can read and an LLM can ingest.
- A plan format expressive enough to encode real periodization (Blocks,
  Mesocycles, Fractals, Weeks, Week Types, Testing Periods) and
  version-controllable as plain YAML.
- A small, deep engine API consumable by other surfaces.

## Access surface

- CLI: `run2max quantify`, `run2max plan ...`
- Engine package: `@run2max/engine` (TypeScript, framework-agnostic)
- Inputs: `.fit` files on disk, `plan.yaml`, `~/.config/run2max/config.yaml`
- Outputs: Markdown / JSON / YAML to stdout or file

## Work boundaries

In scope:
- Single-runner analysis from local `.fit` files
- Periodization modeling and plan execution tracking
- Power-, heart-rate-, and pace-based zones
- Tier-aware metrics (universal FIT, running dynamics, Stryd-enhanced)

Out of scope (today):
- Multi-runner / coach-of-many workflows
- Real-time / live activity streaming
- Cloud sync, server-side persistence, accounts
- Replacing Garmin or Stryd as the recording device

## Generative core

The engine is the generative core: a pure pipeline from FIT bytes + Plan +
Config to AnalysisResult. Every other surface (CLI today, possibly web later)
is an access surface on top of that core. Architectural decisions are judged
against whether they keep the core deep, pure, and free of presentation.

## Coherence signals

- A new feature that fits the model can be added in one or two modules, not
  spread across CLI + engine + plan + formatters.
- Domain terms in code, tests, docs, and CLI output match the glossary
  exactly — no qualifier smell, no aliases.
- Tests assert on structure (markers, capability flags, computed values), not
  on rendered strings.
- The engine has no transitive dependency on a CLI framework, HTTP framework,
  or rendering library.

## Constraints

- TypeScript, pnpm workspace, vitest, framework-agnostic engine.
- Inputs are real Garmin `.fit` files, including Stryd-enhanced ones with
  known quirks (timezone stuck on Mexico City; on-body temp not a weather
  proxy).
- Plan files are YAML, hand-editable, and meant to be diffed in git.
- Macro periodization model: Block → Mesocycle → Fractal → Week, with Week
  Types `L`, `LL`, `LLL`, `D`, `Ta`, `Tb`, `P`, `R`, `N` and executed-only
  `INC`, `DNF`. CP only updates from a `Ta` Testing Period.
- No telemetry, no network calls except optional Open-Meteo weather lookup.
