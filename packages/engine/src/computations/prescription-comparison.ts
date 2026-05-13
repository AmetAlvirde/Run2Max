import type {
  PrescribedRunContext,
  PrescriptionComparison,
  PrescriptionComparisonRunContext,
  PrescriptionStepComparison,
  RunSummary,
  SegmentRow,
} from "../types.js";

const DURATION_TOLERANCE = { short: 5, long: 10 };
const DISTANCE_TOLERANCE_METERS = { short: 50, long: 200 };

function toRunContext(
  prescribedRun: PrescribedRunContext,
): PrescriptionComparisonRunContext {
  return {
    label: prescribedRun.label,
    localDate: prescribedRun.localDate,
    comparisonGroup: prescribedRun.comparisonGroup,
    matchKind: prescribedRun.matchKind,
    weekNumber: prescribedRun.weekNumber,
    weekType: prescribedRun.weekType,
  };
}

function comparePower(step: PrescribedRunContext["steps"][number], segment: SegmentRow): PrescriptionStepComparison["power"] {
  if (!step.targetRange) {
    return {
      status: "unavailable",
      actualAvgPower: segment.avgPower,
      reason: "missing_target_range",
    };
  }

  if (segment.avgPower == null) {
    return {
      status: "unavailable",
      targetRange: step.targetRange,
      actualAvgPower: null,
      reason: "missing_actual_power",
    };
  }

  if (segment.avgPower < step.targetRange.min) {
    return {
      status: "below",
      targetRange: step.targetRange,
      actualAvgPower: segment.avgPower,
      deltaToMin: step.targetRange.min - segment.avgPower,
    };
  }

  if (segment.avgPower > step.targetRange.max) {
    return {
      status: "above",
      targetRange: step.targetRange,
      actualAvgPower: segment.avgPower,
      deltaToMax: segment.avgPower - step.targetRange.max,
    };
  }

  return {
    status: "within",
    targetRange: step.targetRange,
    actualAvgPower: segment.avgPower,
  };
}

function compareCompletion(step: PrescribedRunContext["steps"][number], segment: SegmentRow): PrescriptionStepComparison["completion"] {
  if (step.target.kind === "distance") {
    const prescribedValue = step.target.value * 1000;
    const actualValue = segment.distance;
    const lower = prescribedValue - DISTANCE_TOLERANCE_METERS.short;
    const upper = prescribedValue + DISTANCE_TOLERANCE_METERS.long;
    const status = actualValue < lower
      ? "short"
      : actualValue > upper
        ? "long"
        : "within_tolerance";

    return {
      targetKind: "distance",
      prescribedValue,
      actualValue,
      delta: actualValue - prescribedValue,
      ratio: prescribedValue === 0 ? null : actualValue / prescribedValue,
      status,
      tolerance: {
        lower,
        upper,
      },
    };
  }

  const prescribedValue = step.target.value;
  const actualValue = segment.duration;
  const lower = prescribedValue - DURATION_TOLERANCE.short;
  const upper = prescribedValue + DURATION_TOLERANCE.long;
  const status = actualValue < lower
    ? "short"
    : actualValue > upper
      ? "long"
      : "within_tolerance";

  return {
    targetKind: "duration",
    prescribedValue,
    actualValue,
    delta: actualValue - prescribedValue,
    ratio: prescribedValue === 0 ? null : actualValue / prescribedValue,
    status,
    tolerance: {
      lower,
      upper,
    },
  };
}

export function comparePrescriptionToSegments(
  prescribedRun: PrescribedRunContext,
  segments: SegmentRow[],
  summary: RunSummary,
): PrescriptionComparison {
  const prescribedRunResult = toRunContext(prescribedRun);

  if (segments.length === 0) {
    return {
      status: "unavailable",
      reason: "missing_laps",
      prescribedRun: prescribedRunResult,
      prescribedStepCount: prescribedRun.steps.length,
      actualSegmentCount: 0,
    };
  }

  if (prescribedRun.steps.length !== segments.length) {
    return {
      status: "unavailable",
      reason: "step_count_mismatch",
      prescribedRun: prescribedRunResult,
      prescribedStepCount: prescribedRun.steps.length,
      actualSegmentCount: segments.length,
    };
  }

  return {
    status: "available",
    prescribedRun: prescribedRunResult,
    actual: {
      duration: summary.duration,
      distance: summary.distance,
      avgPower: summary.avgPower,
      avgHeartRate: summary.avgHeartRate,
      maxHeartRate: summary.maxHeartRate,
      avgPace: summary.avgPace,
      ...(summary.rpe == null ? {} : { rpe: summary.rpe }),
    },
    steps: prescribedRun.steps.map((step, position) => {
      const segment = segments[position];
      return {
        index: step.index,
        prescribed: {
          source: step.source,
          target: step.target,
          intensityLabel: step.intensityLabel,
          targetRange: step.targetRange,
        },
        actual: {
          lapIndex: segment.lapIndex,
          distance: segment.distance,
          duration: segment.duration,
          avgPower: segment.avgPower,
          avgHeartRate: segment.avgHeartRate,
          avgPace: segment.avgPace,
        },
        completion: compareCompletion(step, segment),
        power: comparePower(step, segment),
      };
    }),
  };
}
