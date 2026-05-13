import { describe, expect, it } from "vitest";
import type { HistoryArtifactEligible } from "../plan/history.js";
import type { PrescriptionComparisonRunActuals } from "../types.js";
import { computeComparableHistoryDelta } from "./comparable-history.js";

function buildCurrentActuals(): PrescriptionComparisonRunActuals {
  return {
    duration: 3600,
    distance: 10000,
    avgPower: 260,
    avgHeartRate: 160,
    maxHeartRate: 178,
    avgPace: 295,
    rpe: 7,
  };
}

function buildPriorArtifact(): HistoryArtifactEligible {
  return {
    status: "eligible",
    sourcePath: "/tmp/run-1.json",
    format: "json",
    fitBasename: "run-1",
    capturedDate: "2026-05-01",
    comparisonGroup: "Tuesday Intervals",
    actual: {
      duration: 3580,
      distance: 10050,
      avgPower: 250,
      avgHeartRate: 158,
      maxHeartRate: 176,
      avgPace: 300,
      rpe: 6,
    },
  };
}

describe("computeComparableHistoryDelta", () => {
  it("computes available avgPower delta through the public helper", () => {
    const result = computeComparableHistoryDelta(
      buildCurrentActuals(),
      buildPriorArtifact(),
    );

    expect(result.sourcePath).toBe("/tmp/run-1.json");
    expect(result.fitBasename).toBe("run-1");
    expect(result.capturedDate).toBe("2026-05-01");
    expect(result.comparisonGroup).toBe("Tuesday Intervals");
    expect(result.metrics).toContainEqual({
      metric: "avgPower",
      status: "available",
      current: 260,
      prior: 250,
      delta: 10,
    });
  });

  it("returns all supported metrics in stable order when values are present", () => {
    const result = computeComparableHistoryDelta(
      buildCurrentActuals(),
      buildPriorArtifact(),
    );

    expect(result.metrics).toEqual([
      {
        metric: "avgPower",
        status: "available",
        current: 260,
        prior: 250,
        delta: 10,
      },
      {
        metric: "avgHeartRate",
        status: "available",
        current: 160,
        prior: 158,
        delta: 2,
      },
      {
        metric: "maxHeartRate",
        status: "available",
        current: 178,
        prior: 176,
        delta: 2,
      },
      {
        metric: "avgPace",
        status: "available",
        current: 295,
        prior: 300,
        delta: -5,
      },
      {
        metric: "rpe",
        status: "available",
        current: 7,
        prior: 6,
        delta: 1,
      },
    ]);
  });

  it("marks missing current metric values as unavailable", () => {
    const result = computeComparableHistoryDelta(
      {
        ...buildCurrentActuals(),
        avgPower: null,
      },
      buildPriorArtifact(),
    );

    expect(result.metrics).toContainEqual({
      metric: "avgPower",
      status: "unavailable",
      current: null,
      prior: 250,
      reason: "missing_current_value",
    });
  });

  it("marks missing prior metric values as unavailable", () => {
    const prior = buildPriorArtifact();
    const result = computeComparableHistoryDelta(buildCurrentActuals(), {
      ...prior,
      actual: {
        ...prior.actual,
        avgPower: null,
      },
    });

    expect(result.metrics).toContainEqual({
      metric: "avgPower",
      status: "unavailable",
      current: 260,
      prior: null,
      reason: "missing_prior_value",
    });
  });

  it("marks both missing metric values as unavailable", () => {
    const prior = buildPriorArtifact();
    const result = computeComparableHistoryDelta(
      {
        ...buildCurrentActuals(),
        avgPower: null,
      },
      {
        ...prior,
        actual: {
          ...prior.actual,
          avgPower: null,
        },
      },
    );

    expect(result.metrics).toContainEqual({
      metric: "avgPower",
      status: "unavailable",
      current: null,
      prior: null,
      reason: "missing_both_values",
    });
  });

  it("treats absent RPE and non-finite values as missing", () => {
    const prior = buildPriorArtifact();
    const result = computeComparableHistoryDelta(
      {
        ...buildCurrentActuals(),
        avgPower: Number.NaN,
        avgHeartRate: Number.POSITIVE_INFINITY,
        maxHeartRate: Number.NEGATIVE_INFINITY,
        rpe: undefined,
      },
      {
        ...prior,
        actual: {
          ...prior.actual,
          rpe: undefined,
        },
      },
    );

    expect(result.metrics).toContainEqual({
      metric: "avgPower",
      status: "unavailable",
      current: null,
      prior: 250,
      reason: "missing_current_value",
    });
    expect(result.metrics).toContainEqual({
      metric: "avgHeartRate",
      status: "unavailable",
      current: null,
      prior: 158,
      reason: "missing_current_value",
    });
    expect(result.metrics).toContainEqual({
      metric: "maxHeartRate",
      status: "unavailable",
      current: null,
      prior: 176,
      reason: "missing_current_value",
    });
    expect(result.metrics).toContainEqual({
      metric: "rpe",
      status: "unavailable",
      current: null,
      prior: null,
      reason: "missing_both_values",
    });
  });

  it("does not mutate current or prior inputs", () => {
    const current = buildCurrentActuals();
    const prior = buildPriorArtifact();
    const currentSnapshot = structuredClone(current);
    const priorSnapshot = structuredClone(prior);

    computeComparableHistoryDelta(current, prior);

    expect(current).toEqual(currentSnapshot);
    expect(prior).toEqual(priorSnapshot);
  });
});
