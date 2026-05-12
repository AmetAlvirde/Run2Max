# Cycle 02 — Run Prescriptions and Comparisons

Problem: Run2Max can attach a Run to a Week, but it cannot tell whether the Run
matched the specific Prescribed Run and Prescribed Steps the runner intended to
execute.

Who: Serious self-coached runners using local FIT Files, plan.yaml, power zones,
RPE, and saved Run2Max analysis artifacts to review training quality.

Gap: Existing Week Type and Week Progress context can count Runs and identify
the Week, but it cannot compare Tuesday's interval prescription, the captured
lap sequence, or a repeated workout family across the Block.

Distinction: Run2Max treats the Plan as the runner-owned source of truth for
both periodization and concrete run prescriptions, then produces factual
evidence and deltas rather than generic coaching judgment.

Form / access surface: `run2max quantify <fit>` enriches the AnalysisResult with
prescription comparison when the Run has a matching Prescribed Run; saved
detailed YAML/JSON artifacts provide comparable history.
