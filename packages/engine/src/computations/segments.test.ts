import { describe, it, expect } from "vitest";
import { computeSegments } from "./segments.js";
import type { Run2MaxRecord, DataCapabilities } from "../types.js";
import type { LapData } from "normalize-fit-file";

const BASE_TIME = new Date("2026-04-12T08:00:00Z");

function ms(seconds: number): Date {
  return new Date(BASE_TIME.getTime() + seconds * 1000);
}

function rec(
  seconds: number,
  overrides: Partial<Run2MaxRecord> = {},
): Run2MaxRecord {
  return {
    timestamp: ms(seconds),
    power: 220,
    heartRate: 140,
    cadence: 83,
    distance: seconds * 2.5, // ~2.5 m/s
    strydDistance: seconds * 2.5,
    ...overrides,
  } as Run2MaxRecord;
}

function lap(startSec: number, endSec: number): LapData {
  return {
    startTime: ms(startSec),
    timestamp: ms(endSec),
  };
}

const ZONES = [
  { label: "E", name: "Easy", min: 204, max: 233 },
  { label: "M", name: "Marathon", min: 251, max: 260 },
];

const TIER1_ONLY: DataCapabilities = {
  hasRunningDynamics: false,
  hasStrydEnhanced: false,
};

const ALL_TIERS: DataCapabilities = {
  hasRunningDynamics: true,
  hasStrydEnhanced: true,
};

describe("computeSegments", () => {
  it("returns empty array for empty inputs", () => {
    expect(computeSegments([], [], ZONES, TIER1_ONLY)).toEqual([]);
    expect(computeSegments([rec(0)], [], ZONES, TIER1_ONLY)).toEqual([]);
  });

  it("produces one segment for a single lap", () => {
    const records = [rec(0), rec(1), rec(2)];
    const laps = [lap(0, 2)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result).toHaveLength(1);
    expect(result[0].lapIndex).toBe(0);
    expect(result[0].duration).toBe(3);
  });

  it("assigns records to correct laps by timestamp", () => {
    const records = [rec(0), rec(1), rec(2), rec(3), rec(4)];
    const laps = [lap(0, 2), lap(3, 4)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result).toHaveLength(2);
    expect(result[0].duration).toBe(3); // records at 0, 1, 2
    expect(result[1].duration).toBe(2); // records at 3, 4
  });

  it("computes simple-mean averages", () => {
    const records = [
      rec(0, { power: 200 }),
      rec(1, { power: 240 }),
    ];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result[0].avgPower).toBe(220);
  });

  it("computes pace as duration / (distance / 1000)", () => {
    // 3 records, each 2.5m apart = 7.5m total distance over 3s
    const records = [rec(0), rec(1), rec(2)];
    const laps = [lap(0, 2)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    const expectedDistance = 2.5 * 2 - 0; // last - first strydDistance = 5.0m
    const expectedPace = 3 / (expectedDistance / 1000);
    expect(result[0].avgPace).toBeCloseTo(expectedPace);
  });

  it("uses strydDistance preferentially", () => {
    const records = [
      rec(0, { strydDistance: 0, distance: 0 }),
      rec(1, { strydDistance: 100, distance: 95 }),
    ];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result[0].distance).toBe(100); // strydDistance, not distance
  });

  it("falls back to distance when strydDistance is missing", () => {
    const records = [
      rec(0, { strydDistance: undefined, distance: 0 }),
      rec(1, { strydDistance: undefined, distance: 95 }),
    ];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result[0].distance).toBe(95);
  });

  it("skips null values in averages", () => {
    const records = [
      rec(0, { heartRate: null as unknown as number }),
      rec(1, { heartRate: 160 }),
    ];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result[0].avgHeartRate).toBe(160);
  });

  it("classifies avg power into zone", () => {
    const records = [rec(0, { power: 220 }), rec(1, { power: 220 })];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result[0].zone).toBe("E");
  });

  it("sets zone to null when no zones configured", () => {
    const records = [rec(0)];
    const laps = [lap(0, 0)];
    const result = computeSegments(records, laps, undefined, TIER1_ONLY);

    expect(result[0].zone).toBeNull();
  });

  it("sets Tier 2/3 fields to null when capabilities absent", () => {
    const records = [rec(0, { stanceTime: 350, formPower: 50 })];
    const laps = [lap(0, 0)];
    const result = computeSegments(records, laps, ZONES, TIER1_ONLY);

    expect(result[0].avgStanceTime).toBeNull();
    expect(result[0].formPowerRatio).toBeNull();
  });

  it("computes Tier 2 fields when capabilities present", () => {
    const records = [
      rec(0, { stanceTime: 340, stepLength: 850, verticalOscillation: 45 }),
      rec(1, { stanceTime: 360, stepLength: 870, verticalOscillation: 47 }),
    ];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, ALL_TIERS);

    expect(result[0].avgStanceTime).toBe(350);
    expect(result[0].avgStepLength).toBe(860);
    expect(result[0].avgVerticalOscillation).toBe(46);
  });

  it("computes formPowerRatio when Tier 3 available", () => {
    const records = [
      rec(0, { power: 200, formPower: 60 }),
      rec(1, { power: 200, formPower: 80 }),
    ];
    const laps = [lap(0, 1)];
    const result = computeSegments(records, laps, ZONES, ALL_TIERS);

    // avgFormPower = 70, avgPower = 200, ratio = 0.35
    expect(result[0].formPowerRatio).toBeCloseTo(70 / 200);
  });

  it("computes verticalRatio when Tier 2 available", () => {
    const records = [
      rec(0, { verticalOscillation: 50, stepLength: 1000 }),
    ];
    const laps = [lap(0, 0)];
    const result = computeSegments(records, laps, ZONES, ALL_TIERS);

    // (50 / 1000) * 100 = 5%
    expect(result[0].verticalRatio).toBeCloseTo(5);
  });
});
