import { describe, expect, it } from "vitest";
import type { PrescribedRunContext, RunSummary, SegmentRow } from "../types.js";
import { comparePrescriptionToSegments } from "./prescription-comparison.js";

function buildPrescribedRunContext(): PrescribedRunContext {
  return {
    label: "Tempo Session",
    localDate: "2026-04-12",
    comparisonGroup: "tempo",
    matchKind: "date",
    weekNumber: 4,
    totalWeeks: 12,
    weekType: "LL",
    mesocycle: "Build",
    fractalIndex: 1,
    totalFractals: 2,
    weekStart: "2026-04-06",
    steps: [
      {
        index: 1,
        source: "2.00km @ M[251-260W]",
        target: { kind: "distance", value: 2, unit: "km" },
        intensityLabel: "M",
        targetRange: { metric: "power", min: 251, max: 260, unit: "W" },
      },
    ],
  };
}

function buildDurationPrescribedRunContext(seconds: number): PrescribedRunContext {
  const base = buildPrescribedRunContext();
  return {
    ...base,
    steps: [
      {
        ...base.steps[0],
        source: `${seconds}s @ M[251-260W]`,
        target: { kind: "duration", value: seconds, unit: "seconds" },
      },
    ],
  };
}

function buildSummary(): RunSummary {
  return {
    date: new Date("2026-04-12T08:00:00Z"),
    timezone: "UTC",
    duration: 360,
    movingTime: 360,
    distance: 2000,
    avgPower: 255,
    avgPowerZone: "M",
    avgHeartRate: 164,
    avgHeartRatePctLthr: null,
    avgPace: 180,
    maxHeartRate: 176,
    maxPower: 300,
    maxPace: null,
    totalAscent: null,
    totalDescent: null,
    netElevation: null,
    minAltitude: null,
    maxAltitude: null,
    avgHrZone: null,
    avgPaceZone: null,
    normalizedPower: null,
    intensityFactor: null,
    runStressScore: null,
    rpe: 7,
  };
}

function buildSegment(overrides: Partial<SegmentRow> = {}): SegmentRow {
  return {
    lapIndex: 0,
    distance: 2000,
    duration: 360,
    avgPower: 255,
    zone: "M",
    avgPace: 180,
    avgHeartRate: 164,
    avgCadence: null,
    avgStanceTime: null,
    avgStanceTimeBalance: null,
    avgStepLength: null,
    avgVerticalOscillation: null,
    formPowerRatio: null,
    verticalRatio: null,
    elevGain: null,
    elevLoss: null,
    avgAirPower: null,
    windSpeed: null,
    windDirection: null,
    temperature: null,
    ...overrides,
  };
}

describe("comparePrescriptionToSegments", () => {
  it("returns available distance comparison with meter-based completion values", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment()],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].completion).toMatchObject({
      targetKind: "distance",
      prescribedValue: 2000,
      actualValue: 2000,
      delta: 0,
      ratio: 1,
      status: "within_tolerance",
      tolerance: {
        lower: 1950,
        upper: 2200,
      },
    });
  });

  it("returns available duration comparison with second-based completion values", () => {
    const result = comparePrescriptionToSegments(
      buildDurationPrescribedRunContext(300),
      [buildSegment({ duration: 300 })],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps[0].completion).toMatchObject({
      targetKind: "duration",
      prescribedValue: 300,
      actualValue: 300,
      delta: 0,
      ratio: 1,
      status: "within_tolerance",
      tolerance: {
        lower: 295,
        upper: 310,
      },
    });
  });

  it("classifies duration short boundary inclusively", () => {
    const within = comparePrescriptionToSegments(
      buildDurationPrescribedRunContext(300),
      [buildSegment({ duration: 295 })],
      buildSummary(),
    );
    const short = comparePrescriptionToSegments(
      buildDurationPrescribedRunContext(300),
      [buildSegment({ duration: 294 })],
      buildSummary(),
    );

    expect(within.status).toBe("available");
    expect(short.status).toBe("available");
    if (within.status !== "available" || short.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(within.steps[0].completion.status).toBe("within_tolerance");
    expect(short.steps[0].completion.status).toBe("short");
  });

  it("classifies duration long boundary inclusively", () => {
    const within = comparePrescriptionToSegments(
      buildDurationPrescribedRunContext(300),
      [buildSegment({ duration: 310 })],
      buildSummary(),
    );
    const long = comparePrescriptionToSegments(
      buildDurationPrescribedRunContext(300),
      [buildSegment({ duration: 311 })],
      buildSummary(),
    );

    expect(within.status).toBe("available");
    expect(long.status).toBe("available");
    if (within.status !== "available" || long.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(within.steps[0].completion.status).toBe("within_tolerance");
    expect(long.steps[0].completion.status).toBe("long");
  });

  it("classifies distance short boundary inclusively", () => {
    const within = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ distance: 1950 })],
      buildSummary(),
    );
    const short = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ distance: 1949 })],
      buildSummary(),
    );

    expect(within.status).toBe("available");
    expect(short.status).toBe("available");
    if (within.status !== "available" || short.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(within.steps[0].completion.status).toBe("within_tolerance");
    expect(short.steps[0].completion.status).toBe("short");
  });

  it("classifies distance long boundary inclusively", () => {
    const within = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ distance: 2200 })],
      buildSummary(),
    );
    const long = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ distance: 2201 })],
      buildSummary(),
    );

    expect(within.status).toBe("available");
    expect(long.status).toBe("available");
    if (within.status !== "available" || long.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(within.steps[0].completion.status).toBe("within_tolerance");
    expect(long.steps[0].completion.status).toBe("long");
  });

  it("classifies power below range with delta to min", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ avgPower: 245 })],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps[0].power).toEqual({
      status: "below",
      targetRange: { metric: "power", min: 251, max: 260, unit: "W" },
      actualAvgPower: 245,
      deltaToMin: 6,
    });
  });

  it("classifies power within range", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ avgPower: 255 })],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps[0].power).toEqual({
      status: "within",
      targetRange: { metric: "power", min: 251, max: 260, unit: "W" },
      actualAvgPower: 255,
    });
  });

  it("classifies power above range with delta to max", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ avgPower: 266 })],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps[0].power).toEqual({
      status: "above",
      targetRange: { metric: "power", min: 251, max: 260, unit: "W" },
      actualAvgPower: 266,
      deltaToMax: 6,
    });
  });

  it("returns unavailable power when actual power is missing", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment({ avgPower: null })],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps[0].power).toEqual({
      status: "unavailable",
      targetRange: { metric: "power", min: 251, max: 260, unit: "W" },
      actualAvgPower: null,
      reason: "missing_actual_power",
    });
  });

  it("returns unavailable power when target range is missing", () => {
    const prescribedRun = buildPrescribedRunContext();
    prescribedRun.steps[0] = {
      ...prescribedRun.steps[0],
      targetRange: undefined,
    };
    const result = comparePrescriptionToSegments(
      prescribedRun,
      [buildSegment({ avgPower: 255 })],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.steps[0].power).toEqual({
      status: "unavailable",
      actualAvgPower: 255,
      reason: "missing_target_range",
    });
  });

  it("returns unavailable missing_laps when segments are empty", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [],
      buildSummary(),
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "missing_laps",
      prescribedRun: {
        label: "Tempo Session",
        localDate: "2026-04-12",
        comparisonGroup: "tempo",
        matchKind: "date",
        weekNumber: 4,
        weekType: "LL",
      },
      prescribedStepCount: 1,
      actualSegmentCount: 0,
    });
  });

  it("returns unavailable step_count_mismatch with both counts", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment(), buildSegment({ lapIndex: 1 })],
      buildSummary(),
    );

    expect(result).toEqual({
      status: "unavailable",
      reason: "step_count_mismatch",
      prescribedRun: {
        label: "Tempo Session",
        localDate: "2026-04-12",
        comparisonGroup: "tempo",
        matchKind: "date",
        weekNumber: 4,
        weekType: "LL",
      },
      prescribedStepCount: 1,
      actualSegmentCount: 2,
    });
  });

  it("copies run-level RPE when present", () => {
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment()],
      buildSummary(),
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect(result.actual.rpe).toBe(7);
  });

  it("omits run-level RPE when absent", () => {
    const summary = buildSummary();
    summary.rpe = undefined;
    const result = comparePrescriptionToSegments(
      buildPrescribedRunContext(),
      [buildSegment()],
      summary,
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") {
      throw new Error("expected available comparison");
    }

    expect("rpe" in result.actual).toBe(false);
  });
});
