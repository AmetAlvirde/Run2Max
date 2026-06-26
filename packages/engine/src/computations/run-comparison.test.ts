import { describe, expect, it } from "vitest";
import {
  computeRunComparison,
  extractRunComparisonSide,
} from "./run-comparison.js";
import type { RunComparisonSide } from "./run-comparison.js";

function side(overrides: Partial<RunComparisonSide> = {}): RunComparisonSide {
  return {
    label: "side",
    performance: {
      duration: 3600,
      distance: 10000,
      avgPower: 250,
      avgHeartRate: 158,
      maxHeartRate: 176,
      avgPace: 300,
      rpe: 6,
    },
    conditions: {
      temperature: 12,
      windSpeed: 5,
      totalAscent: 120,
      humidity: 80,
      dewPoint: 8,
    },
    context: { conditions: "Clear", windDirection: 180 },
    ...overrides,
  };
}

describe("computeRunComparison", () => {
  it("computes delta = comparand − baseline with pace sign unflipped", () => {
    const baseline = side({ label: "baseline" });
    const comparand = side({
      label: "comparand",
      performance: { ...side().performance, avgPower: 260, avgPace: 295 },
    });

    const result = computeRunComparison(baseline, comparand);

    expect(result.performance).toContainEqual({
      metric: "avgPower",
      status: "available",
      baseline: 250,
      comparand: 260,
      delta: 10,
    });
    // Faster comparand → negative pace delta (sign unflipped).
    expect(result.performance).toContainEqual({
      metric: "avgPace",
      status: "available",
      baseline: 300,
      comparand: 295,
      delta: -5,
    });
  });

  it("degrades a conditions metric missing on one side to unavailable", () => {
    const baseline = side({ label: "baseline" });
    const comparand = side({
      label: "comparand",
      conditions: { ...side().conditions, temperature: null },
    });

    const result = computeRunComparison(baseline, comparand);

    expect(result.conditions).toContainEqual({
      metric: "temperature",
      status: "unavailable",
      baseline: 12,
      comparand: null,
      reason: "missing_comparand_value",
    });
  });

  it("carries context-only conditions for both sides without a delta", () => {
    const result = computeRunComparison(
      side({ context: { conditions: "Clear", windDirection: 180 } }),
      side({ context: { conditions: "Cloudy", windDirection: 200 } }),
    );

    expect(result.context).toContainEqual({
      field: "windDirection",
      baseline: 180,
      comparand: 200,
    });
  });
});

describe("extractRunComparisonSide", () => {
  it("pulls performance from summary and conditions from weather/elevation", () => {
    const artifact = {
      summary: {
        duration: 3600,
        distance: 10000,
        avgPower: 250,
        avgHeartRate: 158,
        maxHeartRate: 176,
        avgPace: 300,
        rpe: 6,
      },
      weatherSummary: {
        temperature: 12,
        humidity: 80,
        dewPoint: 8,
        windSpeed: 5,
        windDirection: 180,
        conditions: "Clear",
      },
      elevationProfile: { totalAscent: 120 },
    };

    const result = extractRunComparisonSide(artifact, "run-1");

    expect(result.label).toBe("run-1");
    expect(result.performance.avgPower).toBe(250);
    expect(result.conditions.temperature).toBe(12);
    expect(result.conditions.totalAscent).toBe(120);
    expect(result.context.conditions).toBe("Clear");
  });

  it("nulls all conditions when the weather section is absent", () => {
    const artifact = {
      summary: { duration: 3600, distance: 10000 },
    };

    const result = extractRunComparisonSide(artifact, "run-2");

    expect(result.conditions.temperature).toBeNull();
    expect(result.conditions.humidity).toBeNull();
    expect(result.context.conditions).toBeNull();
    expect(result.performance.duration).toBe(3600);
  });
});
