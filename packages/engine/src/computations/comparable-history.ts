import type { HistoryArtifactEligible } from "../plan/history.js";
import type { PrescriptionComparisonRunActuals } from "../types.js";
import { numericDelta } from "./metric-delta.js";

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
  // left = current run, right = prior run → delta = current - prior.
  const d = numericDelta(current[metric], prior.actual[metric]);

  if (d.missing === "none") {
    return {
      metric,
      status: "available",
      current: d.left as number,
      prior: d.right as number,
      delta: d.delta as number,
    };
  }

  const reason: ComparableHistoryUnavailableReason =
    d.missing === "both"
      ? "missing_both_values"
      : d.missing === "left"
        ? "missing_current_value"
        : "missing_prior_value";

  return {
    metric,
    status: "unavailable",
    current: d.left,
    prior: d.right,
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
