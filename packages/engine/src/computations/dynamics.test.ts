import { describe, it, expect } from "vitest";
import { computeDynamicsSummary } from "./dynamics.js";
import type { Run2MaxRecord, DataCapabilities } from "../types.js";

function rec(overrides: Partial<Run2MaxRecord> = {}): Run2MaxRecord {
  return {
    timestamp: new Date(),
    power: 220,
    heartRate: 140,
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

const TIER3_ONLY: DataCapabilities = {
  hasRunningDynamics: false,
  hasStrydEnhanced: true,
};

const ALL_TIERS: DataCapabilities = {
  hasRunningDynamics: true,
  hasStrydEnhanced: true,
};

describe("computeDynamicsSummary", () => {
  it("returns null for Tier 1 only", () => {
    const records = [rec()];
    expect(computeDynamicsSummary(records, TIER1_ONLY)).toBeNull();
  });

  it("computes Tier 2 fields, sets Tier 3 fields to null", () => {
    const records = [
      rec({
        stanceTime: 340,
        stanceTimeBalance: 50.2,
        stepLength: 850,
        verticalOscillation: 45,
        verticalOscillationBalance: 49.8,
      }),
      rec({
        stanceTime: 360,
        stanceTimeBalance: 50.4,
        stepLength: 870,
        verticalOscillation: 47,
        verticalOscillationBalance: 50.2,
      }),
    ];
    const result = computeDynamicsSummary(records, TIER2_ONLY)!;

    expect(result).not.toBeNull();
    expect(result.avgStanceTime).toBe(350);
    expect(result.avgStepLength).toBe(860);
    expect(result.avgVerticalOscillation).toBe(46);
    expect(result.avgStanceTimeBalance).toBeCloseTo(50.3);
    expect(result.avgVerticalOscillationBalance).toBe(50);

    // Tier 3 should be null
    expect(result.avgFormPower).toBeNull();
    expect(result.avgAirPower).toBeNull();
    expect(result.avgLegSpringStiffness).toBeNull();
    expect(result.avgFormPowerRatio).toBeNull();
  });

  it("computes Tier 3 fields, sets Tier 2 fields to null", () => {
    const records = [
      rec({ formPower: 60, airPower: 5, legSpringStiffness: 9.0, power: 200 }),
      rec({ formPower: 80, airPower: 7, legSpringStiffness: 9.2, power: 200 }),
    ];
    const result = computeDynamicsSummary(records, TIER3_ONLY)!;

    expect(result.avgFormPower).toBe(70);
    expect(result.avgAirPower).toBe(6);
    expect(result.avgLegSpringStiffness).toBeCloseTo(9.1);

    // Tier 2 should be null
    expect(result.avgStanceTime).toBeNull();
    expect(result.avgStepLength).toBeNull();
    expect(result.avgVerticalRatio).toBeNull();
  });

  it("computes all fields when both tiers present", () => {
    const records = [
      rec({
        stanceTime: 350,
        stepLength: 900,
        verticalOscillation: 45,
        verticalOscillationBalance: 50,
        formPower: 60,
        airPower: 5,
        legSpringStiffness: 9.0,
        power: 200,
      }),
    ];
    const result = computeDynamicsSummary(records, ALL_TIERS)!;

    expect(result.avgStanceTime).toBe(350);
    expect(result.avgFormPower).toBe(60);
    expect(result.avgFormPowerRatio).toBeCloseTo(60 / 200);
    expect(result.avgVerticalRatio).toBeCloseTo((45 / 900) * 100);
  });

  it("computes FPR per-record then averages", () => {
    const records = [
      rec({ formPower: 60, power: 200 }), // FPR = 0.30
      rec({ formPower: 80, power: 200 }), // FPR = 0.40
    ];
    const result = computeDynamicsSummary(records, ALL_TIERS)!;

    // Average of 0.30 and 0.40 = 0.35
    expect(result.avgFormPowerRatio).toBeCloseTo(0.35);
  });

  it("computes vertical ratio per-record then averages", () => {
    const records = [
      rec({ verticalOscillation: 40, stepLength: 800 }), // 5%
      rec({ verticalOscillation: 60, stepLength: 1000 }), // 6%
    ];
    const result = computeDynamicsSummary(records, ALL_TIERS)!;

    expect(result.avgVerticalRatio).toBeCloseTo(5.5);
  });

  it("skips null values in averages", () => {
    const records = [
      rec({ stanceTime: 350 }),
      rec({ stanceTime: null as unknown as number }),
    ];
    const result = computeDynamicsSummary(records, TIER2_ONLY)!;

    expect(result.avgStanceTime).toBe(350);
  });

  it("returns null for derived ratios when inputs missing", () => {
    const records = [
      rec({ formPower: 60, power: undefined }),
    ];
    const result = computeDynamicsSummary(records, ALL_TIERS)!;

    expect(result.avgFormPowerRatio).toBeNull();
  });
});
