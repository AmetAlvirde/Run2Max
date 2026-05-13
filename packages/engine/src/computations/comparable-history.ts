import type { HistoryArtifactEligible } from "../plan/history.js";
import type { PrescriptionComparisonRunActuals } from "../types.js";

export type ComparableHistoryMetric =
  | "avgPower"
  | "avgHeartRate"
  | "maxHeartRate"
  | "avgPace"
  | "rpe";

export type ComparableHistoryUnavailableReason =
  | "missing_current_value"
  | "missing_prior_value"
  | "missing_both_values";

export type ComparableHistoryMetricDelta =
  | ComparableHistoryMetricDeltaAvailable
  | ComparableHistoryMetricDeltaUnavailable;

export interface ComparableHistoryMetricDeltaAvailable {
  metric: ComparableHistoryMetric;
  status: "available";
  current: number;
  prior: number;
  delta: number;
}

export interface ComparableHistoryMetricDeltaUnavailable {
  metric: ComparableHistoryMetric;
  status: "unavailable";
  current: number | null;
  prior: number | null;
  reason: ComparableHistoryUnavailableReason;
}

export interface ComparableHistoryRunDelta {
  sourcePath: string;
  fitBasename: string;
  capturedDate: string;
  comparisonGroup: string;
  metrics: ReadonlyArray<ComparableHistoryMetricDelta>;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const METRICS: ReadonlyArray<ComparableHistoryMetric> = [
  "avgPower",
  "avgHeartRate",
  "maxHeartRate",
  "avgPace",
  "rpe",
];

function classifyMetric(
  metric: ComparableHistoryMetric,
  current: PrescriptionComparisonRunActuals,
  prior: HistoryArtifactEligible,
): ComparableHistoryMetricDelta {
  const currentValue = toFiniteNumberOrNull(current[metric]);
  const priorValue = toFiniteNumberOrNull(prior.actual[metric]);

  if (currentValue !== null && priorValue !== null) {
    return {
      metric,
      status: "available",
      current: currentValue,
      prior: priorValue,
      delta: currentValue - priorValue,
    };
  }

  const reason: ComparableHistoryUnavailableReason =
    currentValue === null && priorValue === null
      ? "missing_both_values"
      : currentValue === null
        ? "missing_current_value"
        : "missing_prior_value";

  return {
    metric,
    status: "unavailable",
    current: currentValue,
    prior: priorValue,
    reason,
  };
}

export function computeComparableHistoryDelta(
  current: PrescriptionComparisonRunActuals,
  prior: HistoryArtifactEligible,
): ComparableHistoryRunDelta {
  const metrics = METRICS.map((metric) => classifyMetric(metric, current, prior));

  return {
    sourcePath: prior.sourcePath,
    fitBasename: prior.fitBasename,
    capturedDate: prior.capturedDate,
    comparisonGroup: prior.comparisonGroup,
    metrics,
  };
}
