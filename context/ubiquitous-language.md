# Run2Max

> Canonical glossary for this context — terms, relationships, example dialogue.
> Product pitch, goals, and constraints live in `product.md`.
>
> Single-context project. If qualifier smell appears, split into bounded
> contexts via `context-map.md` per `sdp-domain-validate`.

## Periodization

| Term                      | Definition                                                                                                                                                         | Aliases to avoid                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| **Block**                 | A training cycle bounded by a folder containing a `plan.yaml` and its `.fit` files.                                                                                | training block, macrocycle        |
| **Bridge Block**          | A Block without a target race date used to span the gap between race-targeted Blocks.                                                                              | recovery block, off-season        |
| **Plan**                  | The artifact (`plan.yaml` and its parsed form) that specifies a Block's Mesocycles, Fractals, Weeks, and Testing Periods.                                          | training schedule, schedule       |
| **Mesocycle**             | A named sequence of Fractals inside a Plan expressing a single training intent (build, taper, race, etc.).                                                         | phase, segment                    |
| **Fractal**               | An ordered sequence of Weeks inside a Mesocycle representing one repetition of its pattern.                                                                        | microcycle group, repeat          |
| **Week**                  | The smallest macro unit, with a `planned` Week Type, an optional `executed` Week Type, and an optional `reason` and `note`.                                        | microcycle                        |
| **Prescribed Run**        | A Block-specific planned running unit on a Week that describes what the runner intended to do on a given day before any FIT File exists.                           | workout, session                  |
| **Prescription Notation** | A compact text expression that specifies the ordered Prescribed Steps of a Prescribed Run.                                                                         | workout string, interval notation |
| **Comparison Group**      | A runner-assigned identifier that marks Prescribed Runs as meaningfully comparable across a Block.                                                                 | similar workout, workout family   |
| **Prescribed Step**       | A lap-aligned planned subdivision of a Prescribed Run, such as warmup, rep, recovery, or cooldown.                                                                 | interval, split                   |
| **Week Type**             | A one- or two-letter code denoting the intended or actual character of a Week (`L`, `LL`, `LLL`, `D`, `Ta`, `Tb`, `P`, `R`, `N`, plus executed-only `INC`, `DNF`). | week tag, label                   |
| **Testing Period**        | A test Week's measured outputs (`cp`, `eFtp`, `lthr`, `zones`) recorded on the Week itself.                                                                        | test result, fitness test         |
| **Reason**                | One of a constrained set of explanations attached to a Week when execution diverges from plan (`illness`, `injury`, `travel`, `personal`, `weather`, `schedule`).  | excuse, deviation cause           |

## Runs and capture

| Term                         | Definition                                                                                                                                            | Aliases to avoid           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Run**                      | A single recorded running activity captured as a `.fit` file.                                                                                         | activity, workout, session |
| **FIT File**                 | The Garmin FIT-format file produced by a watch or pod that serves as the input to all analysis.                                                       | recording, data file       |
| **Tier 1 / Tier 2 / Tier 3** | A capability stratification of fields available on a Run: universal FIT (Tier 1), standard running dynamics (Tier 2), Stryd-enhanced fields (Tier 3). | basic / advanced data      |
| **Running Dynamics**         | Tier 2 mechanics fields: stance time, step length, vertical oscillation, and their balances.                                                          | form metrics, biomechanics |
| **Stryd-enhanced**           | Tier 3 fields produced by a Stryd footpod: form power, air power, leg spring stiffness, on-body temperature/humidity.                                 | Stryd extras               |

## Metrics and zones

| Term                       | Definition                                                                                      | Aliases to avoid                |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------- |
| **Critical Power (CP)**    | The runner's sustainable-power threshold in watts, set only after a `Ta` test Week is executed. | FTP, threshold power            |
| **eFTP**                   | An estimated functional threshold power entered manually from external interval analysis.       | estimated FTP                   |
| **LTHR**                   | The runner's lactate-threshold heart rate in bpm.                                               | threshold HR                    |
| **Zone**                   | A labeled intensity band defined by a `min`/`max` pair over power, heart rate, or pace.         | intensity bucket, training band |
| **Target Range**           | The explicit numeric range on a Prescribed Step used as the authoritative comparison target.    | zone snapshot, inline zone      |
| **RPE**                    | The runner's post-Run rating of perceived exertion recorded as run-level metadata.              | effort score                    |
| **Normalized Power (NP)**  | Coggan-style smoothed-and-weighted average power over a Run.                                    | weighted power                  |
| **Intensity Factor (IF)**  | The ratio `NP / CP` for a Run; null when CP is not set.                                         | relative intensity              |
| **Run Stress Score (RSS)** | This project's name for Coggan TSS computed from a Run's NP, IF, and duration.                  | TSS, training stress            |

## Analysis output

| Term                        | Definition                                                                                                                                                                                   | Aliases to avoid                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Quantify**                | The pipeline that turns one FIT File into an AnalysisResult, optionally enriched with Plan Context.                                                                                          | analyze, compute                      |
| **AnalysisResult**          | The full structured output for one Run: summary, segments, km splits, zone distributions, dynamics, elevation, weather, anomalies, capabilities, and optional Plan and prescription context. | report, output                        |
| **Analysis Artifact**       | A saved YAML or JSON representation of an AnalysisResult produced by Run2Max.                                                                                                                | exported report, saved output         |
| **Output Profile**          | The selection of AnalysisResult sections and columns included when formatting an Analysis Artifact.                                                                                          | report profile                        |
| **Prescription Comparison** | The structured portion of an AnalysisResult that compares one Run to its associated Prescribed Run by Prescribed Step order.                                                                 | workout comparison, interval analysis |
| **Completion Tolerance**    | The accepted lower and upper actual-value bounds for classifying Prescribed Step completion against its duration or distance target.                                                         | margin of error, pass/fail threshold  |
| **Segment**                 | A lap-indexed slice of a Run derived from FIT lap markers.                                                                                                                                   | lap, interval                         |
| **Km Split**                | A 1-kilometer slice of a Run derived independently of lap markers.                                                                                                                           | kilometer, split                      |
| **Anomaly**                 | A flagged data quality issue on a Run (`zero_value`, `spike`, or `missing`) optionally excluded from aggregations.                                                                           | data error, glitch                    |
| **Capabilities**            | The booleans on an AnalysisResult declaring whether Tier 2 and Tier 3 data are present.                                                                                                      | features, support flags               |
| **Plan Context**            | The periodization metadata attached to an AnalysisResult when a `plan.yaml` is present (Block, Week Number, Week Type, Mesocycle, Fractal index, Week Progress).                             | plan info                             |
| **Week Progress**           | The completed-vs-expected Run count for the current Week derived from Run association.                                                                                                       | adherence                             |

## Relationships

- A **Block** is specified by exactly one **Plan**.
- A **Plan** contains one or more **Mesocycles** in order.
- A **Mesocycle** contains one or more **Fractals** in order.
- A **Fractal** contains one or more **Weeks** in order.
- A **Week** has exactly one planned **Week Type** and at most one executed
  **Week Type**.
- A **Week** may contain zero or more **Prescribed Runs**.
- A **Prescribed Run** may be authored from **Prescription Notation**.
- A **Prescribed Run** may belong to one **Comparison Group**.
- A **Prescribed Run** contains one or more **Prescribed Steps** when interval
  comparison is expected.
- A **Run** is associated with at most one **Week** (date-based, file-numbering,
  or `--plan` override).
- A **Run** is associated with at most one **Prescribed Run** for comparison,
  normally by local date with an explicit override for moved or ambiguous Runs.
- A **Run** produces exactly one **AnalysisResult** per **Quantify** invocation.
- An **Analysis Artifact** is produced from exactly one **AnalysisResult** using
  one **Output Profile**.
- A **Prescription Comparison** belongs to exactly one **AnalysisResult** and
  compares one **Run** to at most one associated **Prescribed Run**.
- A **Prescription Comparison** uses **Completion Tolerance** to classify each
  comparable **Prescribed Step** as within tolerance, short, or long.
- A **Zone** belongs to exactly one **Testing Period**, which belongs to exactly
  one **Week**.
- A **Prescribed Step** may declare a **Target Range** when numeric comparison
  is expected.
- **CP** is only updated by a **Testing Period** whose Week's executed type was
  `Ta`.

## Example dialogue

> **Dev:** "Where do we record the runner's new threshold after a CP test?"
> **Domain expert:** "On the Testing Period of the Week whose executed type was
> `Ta` — `Tb` alone never updates CP."

> **Dev:** "What if a Week has zero runs?" **Domain expert:** "Mark its executed
> type `DNF`. Three or fewer Runs is `INC`. Both are executed-only — they can't
> appear in `planned`."

> **Dev:** "If the FIT file has no Stryd fields, what happens to RSS?" **Domain
> expert:** "RSS only needs power, NP, and CP. Stryd fields drive Running
> Dynamics and Tier 3 metrics, not RSS."

> **Dev:** "Can a single Mesocycle span two Blocks?" **Domain expert:** "No. A
> Mesocycle is owned by one Plan, and a Plan specifies exactly one Block.
> Cross-Block continuity is expressed by sequencing Blocks, not by sharing
> Mesocycles."

> **Dev:** "Where do Mesocycles live — on the Block or the Plan?" **Domain
> expert:** "On the Plan. The Block is the training cycle as a whole; the Plan
> is the spec the runner is following. The Block folder bundles the Plan with
> the Runs and any supporting files."

> **Dev:** "Is Tuesday's workout a Run?" **Domain expert:** "No. Before the file
> exists it is a Prescribed Run on the Week; after capture it is a Run that may
> be compared against that prescription."

> **Dev:** "Do we compare only the four hard reps in `4x5min`, or the whole lap
> sequence?" **Domain expert:** "The Prescribed Run contains every Prescribed
> Step, but conclusions may focus on the work reps."

> **Dev:** "Should I hand-enter every Prescribed Step if I already have
> `1.6K @ E → 4(3min@SUB-T/1min@E) → 1.6K @ E`?" **Domain expert:** "No. That is
> Prescription Notation; Run2Max should parse it into Prescribed Steps for
> comparison."

> **Dev:** "If `E` changes after a `Ta`, how do we know which watts applied to
> the earlier Prescribed Run?" **Domain expert:** "Use the Prescribed Step's
> Target Range, such as `E[205-234W]`, as the historical comparison target."

> **Dev:** "What if I do Tuesday's Prescribed Run on Wednesday?" **Domain
> expert:** "The default association is by local date, but the runner can
> explicitly override the Prescribed Run for comparison."

> **Dev:** "Can Run2Max assume two identical prescriptions are worth comparing?"
> **Domain expert:** "No. Prescribed Runs are compared across the Block only
> when they share a Comparison Group."

> **Dev:** "Can historical deltas use any old saved output file?" **Domain
> expert:** "No. They use a detailed Analysis Artifact with the sections and
> columns required for comparison."

> **Dev:** "If the watch did not record usable lap markers, should we infer the
> interval boundaries from power spikes?" **Domain expert:** "No. A Prescription
> Comparison uses FIT lap-derived Segments, or it says comparison is
> unavailable."

> **Dev:** "If the Prescribed Run has eight Prescribed Steps but the FIT File
> has seven laps, should we compare the first seven?" **Domain expert:** "No.
> The step and Segment counts must line up before the Prescription Comparison
> reports step evidence."

> **Dev:** "Can the current Zone config fill in a missing power range on a
> Prescribed Step?" **Domain expert:** "No. Use the Prescribed Step's Target
> Range; current Zones are not historical comparison targets."

> **Dev:** "Does a five-minute Prescribed Step require exactly five minutes of
> elapsed time?" **Domain expert:** "No. Completion Tolerance allows small
> execution drift before classifying the step as short or long."

## Flagged ambiguities

- "Plan" was used throughout code, the `plan.yaml` schema, and cycle 01 PRD
  without a glossary definition, while **Block** was defined as the folder
  containing both the plan and its `.fit` files — resolved: **Plan** added as a
  distinct term (the spec); **Block** remains the training cycle that the Plan
  specifies. Mesocycle ownership moved from Block to Plan in the relationships
  section.
- "Workout" is used by the CLI and FIT-derived summary metadata, but the next
  Plan-adherence cycle needs a pre-capture planned unit — resolved: use
  **Prescribed Run** for the planned unit and keep **Run** for the captured FIT
  File.
- Zone labels in Prescription Notation were ambiguous after CP changes —
  resolved for the next feature cycle: use explicit **Target Range** values on
  comparable Prescribed Steps rather than relying on mutable config history.
