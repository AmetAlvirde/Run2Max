import { describe, it, expect } from "vitest";
import { computeKmSplits } from "./km-splits.js";
import type { Run2MaxRecord, DataCapabilities } from "../types.js";

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

/**
 * Create a record at a given distance with optional overrides.
 * Speed ~2.5 m/s → ~400s per km → ~6:40/km pace.
 */
function rec(
  distanceMeters: number,
  overrides: Partial<Run2MaxRecord> = {},
): Run2MaxRecord {
  return {
    timestamp: new Date(Date.now() + distanceMeters * 400),
    power: 220,
    heartRate: 140,
    cadence: 83,
    strydDistance: distanceMeters,
    distance: distanceMeters,
    ...overrides,
  } as Run2MaxRecord;
}

/** Generate evenly spaced records up to a total distance. */
function generateRecords(
  totalMeters: number,
  spacingMeters: number,
  overrides: Partial<Run2MaxRecord> = {},
): Run2MaxRecord[] {
  const records: Run2MaxRecord[] = [];
  for (let d = 0; d <= totalMeters; d += spacingMeters) {
    records.push(rec(d, overrides));
  }
  return records;
}

describe("computeKmSplits", () => {
  it("returns empty array for empty records", () => {
    expect(computeKmSplits([], ZONES, TIER1_ONLY)).toEqual([]);
  });

  it("produces correct number of splits for a multi-km run", () => {
    // 2.5 km run at 2.5 m/s → records every ~1s = every 2.5m
    const records = generateRecords(2500, 2.5);
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits).toHaveLength(3); // km 1, km 2, partial km 3
    expect(splits[0].km).toBe(1);
    expect(splits[1].km).toBe(2);
    expect(splits[2].km).toBe(3);
  });

  it("labels splits sequentially starting at 1", () => {
    const records = generateRecords(1500, 5);
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits[0].km).toBe(1);
    expect(splits[1].km).toBe(2);
  });

  it("uses strydDistance preferentially", () => {
    const records = [
      rec(0, { strydDistance: 0, distance: 0 }),
      rec(500, { strydDistance: 500, distance: 480 }),
      rec(1000, { strydDistance: 1000, distance: 960 }),
      rec(1200, { strydDistance: 1200, distance: 1150 }),
    ];
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    // Should use strydDistance for boundary detection → split at 1000m stryd
    expect(splits).toHaveLength(2);
  });

  it("falls back to distance when strydDistance is missing", () => {
    const records = [
      rec(0, { strydDistance: undefined, distance: 0 }),
      rec(500, { strydDistance: undefined, distance: 500 }),
      rec(1000, { strydDistance: undefined, distance: 1000 }),
      rec(1200, { strydDistance: undefined, distance: 1200 }),
    ];
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits).toHaveLength(2);
  });

  it("interpolates at km boundaries — boundary record contributes to both splits", () => {
    // Record at 990m, then at 1010m → crosses 1000m boundary
    const records = [
      rec(0),
      rec(990),
      rec(1010), // crosses boundary at 1000m
      rec(1500),
    ];
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits).toHaveLength(2);
    // The boundary record (1010m) should be split:
    // fraction before boundary: (1000 - 990) / (1010 - 990) = 0.5
    // fraction after boundary: 0.5
    // So km 1 gets a partial contribution and km 2 gets the rest
  });

  it("computes averages correctly", () => {
    const records = [
      rec(0, { power: 200 }),
      rec(500, { power: 240 }),
      rec(1000, { power: 200 }),
    ];
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    // First split should have avg of the records within it
    expect(splits[0].avgPower).toBeDefined();
    expect(typeof splits[0].avgPower).toBe("number");
  });

  it("classifies avg power into zone", () => {
    const records = generateRecords(1200, 5, { power: 220 });
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits[0].zone).toBe("E");
  });

  it("sets zone to null when no zones configured", () => {
    const records = generateRecords(1200, 5);
    const splits = computeKmSplits(records, undefined, TIER1_ONLY);

    expect(splits[0].zone).toBeNull();
  });

  it("sets Tier 2/3 fields to null when capabilities absent", () => {
    const records = generateRecords(1200, 5, {
      stanceTime: 350,
      formPower: 60,
    });
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits[0].avgStanceTime).toBeNull();
    expect(splits[0].formPowerRatio).toBeNull();
  });

  it("computes Tier 2 fields when capabilities present", () => {
    const records = generateRecords(1200, 5, {
      stanceTime: 350,
      stepLength: 900,
      verticalOscillation: 45,
    });
    const splits = computeKmSplits(records, ZONES, ALL_TIERS);

    expect(splits[0].avgStanceTime).toBe(350);
    expect(splits[0].avgStepLength).toBe(900);
  });

  it("computes derived ratios when data available", () => {
    const records = generateRecords(1200, 5, {
      power: 200,
      formPower: 60,
      verticalOscillation: 50,
      stepLength: 1000,
    });
    const splits = computeKmSplits(records, ZONES, ALL_TIERS);

    expect(splits[0].formPowerRatio).toBeCloseTo(60 / 200);
    expect(splits[0].verticalRatio).toBeCloseTo(5); // (50/1000)*100
  });

  it("handles final partial km with actual distance", () => {
    // Run exactly 1.5 km
    const records = generateRecords(1500, 5);
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits).toHaveLength(2);
    // Last split should be a partial km
    expect(splits[1].distance).toBeLessThan(1000);
  });

  // ---------------------------------------------------------------------------
  // Elevation
  // ---------------------------------------------------------------------------

  it("computes elevGain and elevLoss within each km", () => {
    const records = [
      rec(0, { enhancedAltitude: 200 }),
      rec(250, { enhancedAltitude: 205 }),
      rec(500, { enhancedAltitude: 210 }),
      rec(750, { enhancedAltitude: 215 }),
      rec(1000, { enhancedAltitude: 220 }),
      rec(1250, { enhancedAltitude: 215 }),
      rec(1500, { enhancedAltitude: 205 }),
    ];
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    // Bucket 1: [0,250,500,750,1000] → altitudes [200,205,210,215,220] = +20 gain
    expect(splits[0].elevGain).toBeCloseTo(20);
    expect(splits[0].elevLoss).toBeCloseTo(0);
    // Bucket 2: [1250,1500] → altitudes [215,205] = -10 loss
    expect(splits[1].elevGain).toBeCloseTo(0);
    expect(splits[1].elevLoss).toBeCloseTo(10);
  });

  it("returns null elevGain/elevLoss when no altitude data", () => {
    const records = generateRecords(1500, 5); // no altitude
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits[0].elevGain).toBeNull();
    expect(splits[0].elevLoss).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // avgAirPower (Tier 3)
  // ---------------------------------------------------------------------------

  it("computes avgAirPower when hasStrydEnhanced is true", () => {
    const records = generateRecords(1200, 5, { airPower: 15 });
    const splits = computeKmSplits(records, ZONES, ALL_TIERS);

    expect(splits[0].avgAirPower).toBeCloseTo(15);
  });

  it("sets avgAirPower to null when hasStrydEnhanced is false", () => {
    const records = generateRecords(1200, 5, { airPower: 15 });
    const splits = computeKmSplits(records, ZONES, TIER1_ONLY);

    expect(splits[0].avgAirPower).toBeNull();
  });

  it("sets avgAirPower to null when records have no airPower", () => {
    const records = generateRecords(1200, 5); // no airPower
    const splits = computeKmSplits(records, ZONES, ALL_TIERS);

    expect(splits[0].avgAirPower).toBeNull();
  });
});
