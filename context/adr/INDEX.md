# ADR Index

| # | Title | Scope | Status | Summary |
| --- | --- | --- | --- | --- |
| 0001 | Plan walker uses eager array context surface | product | accepted | Standardize Plan-tree traversal on `walkPlan(plan): readonly WeekContext[]` to replace inline loops and private flatten helpers. |
| 0002 | Plan-family interfaces live in `plan/types.ts` | product | accepted | Keep public Plan domain types as named interfaces in a standalone module, separate from parser/schema definitions. |
| 0003 | Split aggregation uses pre-bucketed input | product | accepted | Standardize shared aggregation on `aggregateBucket(bucket, config)` while keeping bucket discovery in each computation module. |
| 0004 | Plan-status formatters live in engine formatters and remain engine-public | product | accepted | Keep plan-status rendering in `formatters/plan.ts` while continuing engine-surface exports for formatter consumers. |
| 0005 | Prescribed Runs store expanded steps on the parsed Plan | product | accepted | Parse Prescription Notation during Plan parsing and store expanded ordered `PrescribedStep[]` on each `PrescribedRun` to avoid downstream reparsing. |
| 0006 | Comparable intensity label classification and v1 repetition cap | product | accepted | Parser owns `NON_COMPARABLE_LABELS` (`E`, `LR`, `REC`); all other labels require a Target Range in comparable mode. `parsePlan` always uses comparable mode. Repetition cap is 20. |
| 0007 | parsePlan throws typed PrescriptionNotationError rather than returning a result type | product | accepted | Keep `parsePlan` throwing; replace plain `Error` with `PrescriptionNotationError` carrying structured diagnostics. `loadPlan` re-throws with file path context, preserving the typed payload. |
