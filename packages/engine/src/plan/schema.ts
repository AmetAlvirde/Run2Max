import * as v from "valibot";

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function transformKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        snakeToCamel(k),
        transformKeys(v),
      ])
    );
  }
  return value;
}

export const PLANNED_WEEK_TYPES = ["L", "LL", "LLL", "D", "Ta", "Tb", "P", "R", "N"] as const;
export const EXECUTED_ONLY_TYPES = ["INC", "DNF"] as const;
export const ALL_WEEK_TYPES = [...PLANNED_WEEK_TYPES, ...EXECUTED_ONLY_TYPES] as const;
export const REASON_CATEGORIES = ["illness", "injury", "travel", "personal", "weather", "schedule"] as const;
export const KNOWN_DISTANCES = ["5k", "10k", "half-marathon", "marathon"] as const;

const TestingPeriodSchema = v.object({
  cp: v.optional(v.number()),
  eFtp: v.optional(v.number()),
  lthr: v.optional(v.number()),
  zones: v.optional(v.record(v.string(), v.object({ min: v.number(), max: v.number() }))),
});

const WeekSchema = v.object({
  planned: v.string(),
  start: v.string(),
  executed: v.optional(v.string()),
  reason: v.optional(v.string()),
  note: v.optional(v.string()),
  testingPeriod: v.optional(TestingPeriodSchema),
});

const FractalSchema = v.object({
  weeks: v.pipe(
    v.array(WeekSchema),
    v.minLength(1, "weeks must contain at least one entry")
  ),
});

const MesocycleSchema = v.object({
  name: v.string(),
  fractals: v.pipe(
    v.array(FractalSchema),
    v.minLength(1, "fractals must contain at least one entry")
  ),
});

export const PlanSchema = v.object({
  schemaVersion: v.literal(1),
  block: v.string(),
  goal: v.optional(v.string()),
  distance: v.optional(v.string()),
  raceDate: v.optional(v.string()),
  start: v.string(),
  mesocycles: v.pipe(
    v.array(MesocycleSchema),
    v.minLength(1, "mesocycles must contain at least one entry")
  ),
});

export type Plan = v.InferOutput<typeof PlanSchema>;
export type Mesocycle = v.InferOutput<typeof MesocycleSchema>;
export type Fractal = v.InferOutput<typeof FractalSchema>;
export type Week = v.InferOutput<typeof WeekSchema>;
export type TestingPeriod = v.InferOutput<typeof TestingPeriodSchema>;

export function parsePlan(raw: unknown): Plan {
  return v.parse(PlanSchema, transformKeys(raw));
}
