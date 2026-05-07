Problem: The engine grew shallow — Plan tree walks, tier-aware split aggregation, presentation, and date math are duplicated or leaked across modules, so every new feature touches four files instead of one and a documented `TS2589` workaround sits in the CLI as evidence of the type-layer drift.

Who: Future maintainers extending `@run2max/engine` and the CLI — the same hands that will add the next periodization, analytics, or sync feature on top of v1.2.0.

Gap: The current shape works, but the seams it exposes (50+ engine exports, five inline `flattenWeeks`, three near-identical row builders for segments / km splits / dynamics, formatters living inside `plan/status.ts`, `v.InferOutput` chains crossing module boundaries) make each new feature pay an integration tax that compounds. The codebase is correct but not leverageable.

Distinction: This is not a speculative redesign. The seams to deepen are already discovered — Plan walker, split aggregator parameterized by bucketing strategy, engine/presentation split, named domain interfaces — and each one passes the deletion test today. The cycle deepens what the code already implies rather than introducing new architecture.

Form / access surface: The public `@run2max/engine` API and the CLI commands that consume it. After the cycle: fewer exports, deeper modules, formatters separated from logic, plain named interfaces in `plan/schema.ts`, no `PlanLike` workaround in CLI, no duplicate `addDays` / `clonePlan` / `transformKeys`. No user-facing behavior change.

Why now: The next feature cycles (further periodization tooling, analytics, sync surface area) will all touch Plan-walking and split-shaped data. Paying the deepening cost once here means those cycles ship as feature work, not as four-file integration work. The branch is already named `refactor/foundation` — the intent exists; this cycle commits to it.
