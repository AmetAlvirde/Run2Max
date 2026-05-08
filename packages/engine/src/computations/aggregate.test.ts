import { describe, expect, it } from "vitest";
import type { DataCapabilities, Run2MaxRecord } from "../types.js";
import { aggregateBucket } from "./aggregate.js";

function rec(overrides: Partial<Run2MaxRecord> = {}): Run2MaxRecord {
  return {
    timestamp: new Date(),
    power: 220,
    heartRate: 140,
    cadence: 84,
    ...overrides,
  } as Run2MaxRecord;
}

const TIER1_ONLY: DataCapabilities = {
  hasRunningDynamics: false,
  hasStrydEnhanced: false,
};

const TIER2_ONLY: DataCapabilities = {
  hasRunningDynamics: true,
  hasStrydEnhanced: false,
};

const ALL_TIERS: DataCapabilities = {
  hasRunningDynamics: true,
  hasStrydEnhanced: true,
};

describe("aggregateBucket", () => {
  it("computes Tier 1 arithmetic means and null-gates Tier 2/Tier 3", () => {
    const result = aggregateBucket(
      [
        { record: rec({ power: 200, heartRate: 130, cadence: 80 }) },
        { record: rec({ power: 240, heartRate: 150, cadence: 88 }) },
      ],
      { capabilities: TIER1_ONLY },
    );

    expect(result.avgPower).toBe(220);
    expect(result.avgHeartRate).toBe(140);
    expect(result.avgCadence).toBe(84);
    expect(result.zone).toBeNull();
    expect(result.avgStanceTime).toBeNull();
    expect(result.avgFormPower).toBeNull();
    expect(result.verticalRatio).toBeNull();
    expect(result.formPowerRatio).toBeNull();
  });

  it("keeps Tier 2 fields null when capability is on but records lack values", () => {
    const result = aggregateBucket(
      [{ record: rec() }, { record: rec() }],
      { capabilities: TIER2_ONLY },
    );

    expect(result.avgStanceTime).toBeNull();
    expect(result.avgStanceTimeBalance).toBeNull();
    expect(result.avgStepLength).toBeNull();
    expect(result.avgVerticalOscillation).toBeNull();
  });

  it("computes Tier 2 and Tier 3 fields with ratio-of-means derived metrics", () => {
    const result = aggregateBucket(
      [
        {
          record: rec({
            power: 200,
            formPower: 50,
            airPower: 10,
            stanceTime: 330,
            stanceTimeBalance: 50.1,
            stepLength: 800,
            verticalOscillation: 40,
          }),
        },
        {
          record: rec({
            power: 300,
            formPower: 90,
            airPower: 14,
            stanceTime: 370,
            stanceTimeBalance: 49.9,
            stepLength: 1000,
            verticalOscillation: 60,
          }),
        },
      ],
      { capabilities: ALL_TIERS },
    );

    expect(result.avgPower).toBe(250);
    expect(result.avgFormPower).toBe(70);
    expect(result.avgAirPower).toBe(12);
    expect(result.avgStanceTime).toBe(350);
    expect(result.avgStepLength).toBe(900);
    expect(result.avgVerticalOscillation).toBe(50);
    expect(result.verticalRatio).toBeCloseTo((50 / 900) * 100);
    expect(result.formPowerRatio).toBeCloseTo(70 / 250);
  });

  it("uses weighted means and per-field null handling", () => {
    const result = aggregateBucket(
      [
        { record: rec({ power: 100, cadence: 80, stepLength: 800 }), weight: 0.5 },
        { record: rec({ power: 300, cadence: null as unknown as number, stepLength: null as unknown as number }), weight: 0.5 },
        { record: rec({ power: 500, cadence: 100, stepLength: 1000 }), weight: 1 },
      ],
      { capabilities: TIER2_ONLY },
    );

    expect(result.avgPower).toBeCloseTo((100 * 0.5 + 300 * 0.5 + 500 * 1) / 2);
    expect(result.avgCadence).toBeCloseTo((80 * 0.5 + 100 * 1) / 1.5);
    expect(result.avgStepLength).toBeCloseTo((800 * 0.5 + 1000 * 1) / 1.5);
  });

  it("returns all-null for empty bucket", () => {
    const result = aggregateBucket([], { capabilities: ALL_TIERS });
    expect(result).toEqual({
      avgPower: null,
      zone: null,
      avgHeartRate: null,
      avgCadence: null,
      avgStanceTime: null,
      avgStanceTimeBalance: null,
      avgStepLength: null,
      avgVerticalOscillation: null,
      avgFormPower: null,
      avgAirPower: null,
      verticalRatio: null,
      formPowerRatio: null,
    });
  });

  it("treats undefined weight as 1", () => {
    const result = aggregateBucket(
      [
        { record: rec({ power: 200 }) },
        { record: rec({ power: 400 }), weight: undefined },
      ],
      { capabilities: TIER1_ONLY },
    );
    expect(result.avgPower).toBe(300);
  });
});
