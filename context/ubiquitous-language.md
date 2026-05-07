# Run2Max

> Canonical glossary for this context — terms, relationships, example
> dialogue. Product pitch, goals, and constraints live in `product.md`.
>
> Single-context project. If qualifier smell appears, split into bounded
> contexts via `context-map.md` per `sdp-domain-validate`.

## Periodization

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Block** | A training cycle bounded by a folder containing a `plan.yaml` and its `.fit` files. | training block, macrocycle |
| **Bridge Block** | A Block without a target race date used to span the gap between race-targeted Blocks. | recovery block, off-season |
| **Mesocycle** | A named sequence of Fractals inside a Block expressing a single training intent (build, taper, race, etc.). | phase, segment |
| **Fractal** | An ordered sequence of Weeks inside a Mesocycle representing one repetition of its pattern. | microcycle group, repeat |
| **Week** | The smallest macro unit, with a `planned` Week Type, an optional `executed` Week Type, and an optional `reason` and `note`. | microcycle |
| **Week Type** | A one- or two-letter code denoting the intended or actual character of a Week (`L`, `LL`, `LLL`, `D`, `Ta`, `Tb`, `P`, `R`, `N`, plus executed-only `INC`, `DNF`). | week tag, label |
| **Testing Period** | A test Week's measured outputs (`cp`, `eFtp`, `lthr`, `zones`) recorded on the Week itself. | test result, fitness test |
| **Reason** | One of a constrained set of explanations attached to a Week when execution diverges from plan (`illness`, `injury`, `travel`, `personal`, `weather`, `schedule`). | excuse, deviation cause |

## Runs and capture

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Run** | A single recorded running activity captured as a `.fit` file. | activity, workout, session |
| **FIT File** | The Garmin FIT-format file produced by a watch or pod that serves as the input to all analysis. | recording, data file |
| **Tier 1 / Tier 2 / Tier 3** | A capability stratification of fields available on a Run: universal FIT (Tier 1), standard running dynamics (Tier 2), Stryd-enhanced fields (Tier 3). | basic / advanced data |
| **Running Dynamics** | Tier 2 mechanics fields: stance time, step length, vertical oscillation, and their balances. | form metrics, biomechanics |
| **Stryd-enhanced** | Tier 3 fields produced by a Stryd footpod: form power, air power, leg spring stiffness, on-body temperature/humidity. | Stryd extras |

## Metrics and zones

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Critical Power (CP)** | The runner's sustainable-power threshold in watts, set only after a `Ta` test Week is executed. | FTP, threshold power |
| **eFTP** | An estimated functional threshold power entered manually from external interval analysis. | estimated FTP |
| **LTHR** | The runner's lactate-threshold heart rate in bpm. | threshold HR |
| **Zone** | A labeled intensity band defined by a `min`/`max` pair over power, heart rate, or pace. | intensity bucket, training band |
| **Normalized Power (NP)** | Coggan-style smoothed-and-weighted average power over a Run. | weighted power |
| **Intensity Factor (IF)** | The ratio `NP / CP` for a Run; null when CP is not set. | relative intensity |
| **Run Stress Score (RSS)** | This project's name for Coggan TSS computed from a Run's NP, IF, and duration. | TSS, training stress |

## Analysis output

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Quantify** | The pipeline that turns one FIT File into an AnalysisResult, optionally enriched with Plan Context. | analyze, compute |
| **AnalysisResult** | The full structured output for one Run: summary, segments, km splits, zone distributions, dynamics, elevation, weather, anomalies, capabilities, optional plan context. | report, output |
| **Segment** | A lap-indexed slice of a Run derived from FIT lap markers. | lap, interval |
| **Km Split** | A 1-kilometer slice of a Run derived independently of lap markers. | kilometer, split |
| **Anomaly** | A flagged data quality issue on a Run (`zero_value`, `spike`, or `missing`) optionally excluded from aggregations. | data error, glitch |
| **Capabilities** | The booleans on an AnalysisResult declaring whether Tier 2 and Tier 3 data are present. | features, support flags |
| **Plan Context** | The periodization metadata attached to an AnalysisResult when a `plan.yaml` is present (Block, Week Number, Week Type, Mesocycle, Fractal index, Week Progress). | plan info |
| **Week Progress** | The completed-vs-expected Run count for the current Week derived from Run association. | adherence |

## Relationships

- A **Block** contains one or more **Mesocycles** in order.
- A **Mesocycle** contains one or more **Fractals** in order.
- A **Fractal** contains one or more **Weeks** in order.
- A **Week** has exactly one planned **Week Type** and at most one executed **Week Type**.
- A **Run** is associated with at most one **Week** (date-based, file-numbering, or `--plan` override).
- A **Run** produces exactly one **AnalysisResult** per **Quantify** invocation.
- A **Zone** belongs to exactly one **Testing Period**, which belongs to exactly one **Week**.
- **CP** is only updated by a **Testing Period** whose Week's executed type was `Ta`.

## Example dialogue

> **Dev:** "Where do we record the runner's new threshold after a CP test?"
> **Domain expert:** "On the Testing Period of the Week whose executed type was `Ta` — `Tb` alone never updates CP."

> **Dev:** "What if a Week has zero runs?"
> **Domain expert:** "Mark its executed type `DNF`. Three or fewer Runs is `INC`. Both are executed-only — they can't appear in `planned`."

> **Dev:** "If the FIT file has no Stryd fields, what happens to RSS?"
> **Domain expert:** "RSS only needs power, NP, and CP. Stryd fields drive Running Dynamics and Tier 3 metrics, not RSS."

> **Dev:** "Can a single Mesocycle span two Blocks?"
> **Domain expert:** "No. A Mesocycle is owned by one Block. Cross-Block continuity is expressed by sequencing Blocks, not by sharing Mesocycles."

## Flagged ambiguities

_(none yet)_
