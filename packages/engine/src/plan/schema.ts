import * as v from "valibot";
import type { Plan } from "./types.js";
import { transformKeysSnakeToCamel } from "./case-keys.js";
import { parsePrescriptionNotation } from "./prescription.js";

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

const PrescribedRunSchema = v.object({
  localDate: v.string(),
  label: v.string(),
  prescription: v.string(),
  comparisonGroup: v.optional(v.string()),
});

const WeekSchema = v.object({
  planned: v.string(),
  start: v.string(),
  executed: v.optional(v.string()),
  reason: v.optional(v.string()),
  note: v.optional(v.string()),
  testingPeriod: v.optional(TestingPeriodSchema),
  prescribedRuns: v.optional(v.array(PrescribedRunSchema)),
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

type PlanWithoutSteps = {
  schemaVersion: 1;
  block: string;
  goal?: string;
  distance?: string;
  raceDate?: string;
  start: string;
  mesocycles: {
    name: string;
    fractals: {
      weeks: {
        planned: string;
        start: string;
        executed?: string;
        reason?: string;
        note?: string;
        testingPeriod?: {
          cp?: number;
          eFtp?: number;
          lthr?: number;
          zones?: Record<string, { min: number; max: number }>;
        };
        prescribedRuns?: {
          localDate: string;
          label: string;
          prescription: string;
          comparisonGroup?: string;
        }[];
      }[];
    }[];
  }[];
};

export function parsePlan(raw: unknown): Plan {
  const parsed = v.parse(PlanSchema, transformKeysSnakeToCamel(raw)) as PlanWithoutSteps;

  return {
    ...parsed,
    mesocycles: parsed.mesocycles.map((mesocycle) => ({
      ...mesocycle,
      fractals: mesocycle.fractals.map((fractal) => ({
        ...fractal,
        weeks: fractal.weeks.map((week) => ({
          ...week,
          prescribedRuns: week.prescribedRuns?.map((run) => {
            const prescriptionParse = parsePrescriptionNotation(run.prescription);
            if (!prescriptionParse.ok) {
              const reason = prescriptionParse.diagnostics[0]?.message ?? "Invalid prescription";
              throw new Error(
                `Invalid prescription notation for prescribed run '${run.label}' on ${run.localDate}: ${reason}`,
              );
            }

            return {
              ...run,
              steps: prescriptionParse.steps,
            };
          }),
        })),
      })),
    })),
  };
}
