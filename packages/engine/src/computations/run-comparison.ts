// Run Comparison — a deterministic, summary-level delta between two
// explicitly-chosen Runs (a baseline and a comparand), independent of any Plan,
// Prescribed Run, or Comparison Group. Built on the shared `numericDelta`
// primitive; the plan-gated Comparable-History Delta path is left untouched.
//
// delta = comparand − baseline (pace sign unflipped).

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { parse as parseYaml } from "yaml";
import { transformKeysSnakeToCamel } from "../plan/case-keys.js";
import { numericDelta } from "./metric-delta.js";

export type RunComparisonPerformanceMetric =
  | "duration"
  | "distance"
  | "avgPower"
  | "avgHeartRate"
  | "maxHeartRate"
  | "avgPace"
  | "rpe";

export type RunComparisonConditionsMetric =
  | "temperature"
  | "windSpeed"
  | "totalAscent"
  | "humidity"
  | "dewPoint";

export type RunComparisonUnavailableReason =
  | "missing_baseline_value"
  | "missing_comparand_value"
  | "missing_both_values";

export interface RunComparisonMetricDeltaAvailable<M extends string> {
  metric: M;
  status: "available";
  baseline: number;
  comparand: number;
  delta: number;
}

export interface RunComparisonMetricDeltaUnavailable<M extends string> {
  metric: M;
  status: "unavailable";
  baseline: number | null;
  comparand: number | null;
  reason: RunComparisonUnavailableReason;
}

export type RunComparisonMetricDelta<M extends string> =
  | RunComparisonMetricDeltaAvailable<M>
  | RunComparisonMetricDeltaUnavailable<M>;

/** Context-only conditions fields: shown for both Runs, never deltad. */
export interface RunComparisonContextField {
  field: "conditions" | "windDirection";
  baseline: string | number | null;
  comparand: string | number | null;
}

/** Quantified inputs for one side of a Run Comparison. */
export interface RunComparisonSide {
  label: string;
  performance: Record<RunComparisonPerformanceMetric, number | null>;
  conditions: Record<RunComparisonConditionsMetric, number | null>;
  context: {
    conditions: string | null;
    windDirection: number | null;
  };
}

export interface RunComparison {
  baseline: { label: string };
  comparand: { label: string };
  performance: ReadonlyArray<RunComparisonMetricDelta<RunComparisonPerformanceMetric>>;
  conditions: ReadonlyArray<RunComparisonMetricDelta<RunComparisonConditionsMetric>>;
  context: ReadonlyArray<RunComparisonContextField>;
}

const PERFORMANCE_METRICS: ReadonlyArray<RunComparisonPerformanceMetric> = [
  "duration",
  "distance",
  "avgPower",
  "avgHeartRate",
  "maxHeartRate",
  "avgPace",
  "rpe",
];

const CONDITIONS_METRICS: ReadonlyArray<RunComparisonConditionsMetric> = [
  "temperature",
  "windSpeed",
  "totalAscent",
  "humidity",
  "dewPoint",
];

function classify<M extends string>(
  metric: M,
  comparandRaw: unknown,
  baselineRaw: unknown,
): RunComparisonMetricDelta<M> {
  // left = comparand, right = baseline → delta = comparand - baseline.
  const d = numericDelta(comparandRaw, baselineRaw);

  if (d.missing === "none") {
    return {
      metric,
      status: "available",
      comparand: d.left as number,
      baseline: d.right as number,
      delta: d.delta as number,
    };
  }

  const reason: RunComparisonUnavailableReason =
    d.missing === "both"
      ? "missing_both_values"
      : d.missing === "left"
        ? "missing_comparand_value"
        : "missing_baseline_value";

  return {
    metric,
    status: "unavailable",
    comparand: d.left,
    baseline: d.right,
    reason,
  };
}

export function computeRunComparison(
  baseline: RunComparisonSide,
  comparand: RunComparisonSide,
): RunComparison {
  return {
    baseline: { label: baseline.label },
    comparand: { label: comparand.label },
    performance: PERFORMANCE_METRICS.map((m) =>
      classify(m, comparand.performance[m], baseline.performance[m]),
    ),
    conditions: CONDITIONS_METRICS.map((m) =>
      classify(m, comparand.conditions[m], baseline.conditions[m]),
    ),
    context: [
      {
        field: "conditions",
        baseline: baseline.context.conditions,
        comparand: comparand.context.conditions,
      },
      {
        field: "windDirection",
        baseline: baseline.context.windDirection,
        comparand: comparand.context.windDirection,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Extraction from a saved Analysis Artifact
// ---------------------------------------------------------------------------

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Pull the comparable sides out of a parsed (already camelCased) Analysis
 * Artifact. Missing weather/elevation sections leave their metrics null, which
 * the comparison reports as unavailable.
 */
export function extractRunComparisonSide(
  artifact: Record<string, unknown>,
  label: string,
): RunComparisonSide {
  const summary = asObject(artifact.summary) ?? {};
  const weather = asObject(artifact.weatherSummary);
  const elevation = asObject(artifact.elevationProfile);

  const totalAscent = elevation
    ? num(elevation.totalAscent)
    : num(summary.totalAscent);

  return {
    label,
    performance: {
      duration: num(summary.duration),
      distance: num(summary.distance),
      avgPower: num(summary.avgPower),
      avgHeartRate: num(summary.avgHeartRate),
      maxHeartRate: num(summary.maxHeartRate),
      avgPace: num(summary.avgPace),
      rpe: num(summary.rpe),
    },
    conditions: {
      temperature: weather ? num(weather.temperature) : null,
      windSpeed: weather ? num(weather.windSpeed) : null,
      totalAscent,
      humidity: weather ? num(weather.humidity) : null,
      dewPoint: weather ? num(weather.dewPoint) : null,
    },
    context: {
      conditions: weather ? str(weather.conditions) : null,
      windDirection: weather ? num(weather.windDirection) : null,
    },
  };
}

/** Read + parse a saved Analysis Artifact file into one comparison side. */
export async function loadRunComparisonSide(
  path: string,
  label?: string,
): Promise<RunComparisonSide> {
  const contents = await readFile(path, "utf-8");
  const isYaml = /\.ya?ml$/i.test(path);
  const parsed: unknown = isYaml ? parseYaml(contents) : JSON.parse(contents);
  const normalized = isYaml ? transformKeysSnakeToCamel(parsed) : parsed;
  const artifact = asObject(normalized);
  if (!artifact) {
    throw new Error(`Artifact at ${path} did not parse to an object`);
  }
  return extractRunComparisonSide(artifact, label ?? basename(path));
}
