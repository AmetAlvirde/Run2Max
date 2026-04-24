import { describe, it, expect } from "vitest";
import {
  getAltitude,
  computeElevationProfile,
  computeSplitElevation,
} from "./elevation.js";
import type { Run2MaxRecord } from "../types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rec(
  opts: {
    altitude?: number;
    enhancedAltitude?: number;
    distance?: number;
    strydDistance?: number;
  } = {},
): Run2MaxRecord {
  return { timestamp: new Date(), ...opts } as Run2MaxRecord;
}

// A flat 5-record sequence at 225 m, 1km each
const FLAT_RECORDS: Run2MaxRecord[] = [
  rec({ enhancedAltitude: 225, strydDistance: 0 }),
  rec({ enhancedAltitude: 225, strydDistance: 1000 }),
  rec({ enhancedAltitude: 225, strydDistance: 2000 }),
  rec({ enhancedAltitude: 225, strydDistance: 3000 }),
  rec({ enhancedAltitude: 225, strydDistance: 4000 }),
];

// A climbing 5-record sequence: 200→250 m over 4km
const CLIMB_RECORDS: Run2MaxRecord[] = [
  rec({ enhancedAltitude: 200, strydDistance: 0 }),
  rec({ enhancedAltitude: 210, strydDistance: 1000 }),
  rec({ enhancedAltitude: 220, strydDistance: 2000 }),
  rec({ enhancedAltitude: 235, strydDistance: 3000 }),
  rec({ enhancedAltitude: 250, strydDistance: 4000 }),
];

// A descending sequence: 250→200 m
const DESCENT_RECORDS: Run2MaxRecord[] = [
  rec({ enhancedAltitude: 250, strydDistance: 0 }),
  rec({ enhancedAltitude: 240, strydDistance: 1000 }),
  rec({ enhancedAltitude: 225, strydDistance: 2000 }),
  rec({ enhancedAltitude: 210, strydDistance: 3000 }),
  rec({ enhancedAltitude: 200, strydDistance: 4000 }),
];

// ---------------------------------------------------------------------------
// getAltitude
// ---------------------------------------------------------------------------

describe("getAltitude", () => {
  it("returns enhancedAltitude when present", () => {
    expect(getAltitude(rec({ enhancedAltitude: 312.5, altitude: 312 }))).toBe(312.5);
  });

  it("falls back to altitude when no enhancedAltitude", () => {
    expect(getAltitude(rec({ altitude: 200 }))).toBe(200);
  });

  it("returns null when neither field is present", () => {
    expect(getAltitude(rec())).toBeNull();
  });

  it("prefers enhancedAltitude even when altitude is 0", () => {
    expect(getAltitude(rec({ enhancedAltitude: 100, altitude: 0 }))).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// computeElevationProfile
// ---------------------------------------------------------------------------

describe("computeElevationProfile", () => {
  it("returns null when no records have altitude data", () => {
    const records = [rec({ distance: 0 }), rec({ distance: 1000 })];
    expect(computeElevationProfile(records, {})).toBeNull();
  });

  it("returns null for empty records array", () => {
    expect(computeElevationProfile([], {})).toBeNull();
  });

  it("uses session totalAscent/totalDescent when provided", () => {
    const session = { totalAscent: 150, totalDescent: 120 };
    const result = computeElevationProfile(CLIMB_RECORDS, session)!;
    expect(result.totalAscent).toBe(150);
    expect(result.totalDescent).toBe(120);
  });

  it("computes totalAscent from records when session value not provided", () => {
    // CLIMB_RECORDS: 200→210→220→235→250, all uphill
    // Deltas: +10+10+15+15 = +50 gain
    const result = computeElevationProfile(CLIMB_RECORDS, {})!;
    expect(result.totalAscent).toBeCloseTo(50);
    expect(result.totalDescent).toBeCloseTo(0);
  });

  it("computes totalDescent from records when session value not provided", () => {
    // DESCENT_RECORDS: 250→240→225→210→200, all downhill
    // Deltas: -10-15-15-10 = -50 loss
    const result = computeElevationProfile(DESCENT_RECORDS, {})!;
    expect(result.totalAscent).toBeCloseTo(0);
    expect(result.totalDescent).toBeCloseTo(50);
  });

  it("computes correct min/max altitude from records", () => {
    const result = computeElevationProfile(CLIMB_RECORDS, {})!;
    expect(result.minAltitude).toBe(200);
    expect(result.maxAltitude).toBe(250);
  });

  it("computes netElevation as ascent minus descent", () => {
    const session = { totalAscent: 150, totalDescent: 120 };
    const result = computeElevationProfile(CLIMB_RECORDS, session)!;
    expect(result.netElevation).toBe(30);
  });

  it("builds points[] as [distanceKm, altitudeM] pairs", () => {
    const result = computeElevationProfile(CLIMB_RECORDS, {})!;
    expect(result.points.length).toBe(CLIMB_RECORDS.length);
    // First point
    expect(result.points[0]).toEqual([0, 200]);
    // Last point: 4000m = 4km
    expect(result.points[4]).toEqual([4, 250]);
  });

  it("uses strydDistance for points when available", () => {
    const result = computeElevationProfile(CLIMB_RECORDS, {})!;
    expect(result.points[2]).toEqual([2, 220]);
  });

  it("falls back to record.distance for points", () => {
    const records = [
      rec({ enhancedAltitude: 100, distance: 0 }),
      rec({ enhancedAltitude: 120, distance: 1000 }),
      rec({ enhancedAltitude: 150, distance: 2000 }),
    ];
    const result = computeElevationProfile(records, {})!;
    expect(result.points[1]).toEqual([1, 120]);
  });

  it("handles flat course (no ascent or descent)", () => {
    const result = computeElevationProfile(FLAT_RECORDS, {})!;
    expect(result.totalAscent).toBeCloseTo(0);
    expect(result.totalDescent).toBeCloseTo(0);
    expect(result.netElevation).toBeCloseTo(0);
    expect(result.minAltitude).toBe(225);
    expect(result.maxAltitude).toBe(225);
  });

  it("skips records with no altitude when building points", () => {
    const mixed = [
      rec({ enhancedAltitude: 200, strydDistance: 0 }),
      rec({ strydDistance: 500 }),                        // no altitude — skipped
      rec({ enhancedAltitude: 220, strydDistance: 1000 }),
    ];
    const result = computeElevationProfile(mixed, {})!;
    expect(result.points.length).toBe(2);
  });

  it("uses both session totalAscent and partial record fallback for descent", () => {
    // Only totalAscent from session, no totalDescent → should compute descent from records
    const session = { totalAscent: 200 };
    const result = computeElevationProfile(DESCENT_RECORDS, session)!;
    expect(result.totalAscent).toBe(200);
    expect(result.totalDescent).toBeCloseTo(50);
  });
});

// ---------------------------------------------------------------------------
// computeSplitElevation
// ---------------------------------------------------------------------------

describe("computeSplitElevation", () => {
  it("returns { gain: 0, loss: 0 } for empty records", () => {
    expect(computeSplitElevation([])).toEqual({ gain: 0, loss: 0 });
  });

  it("returns { gain: 0, loss: 0 } for single record", () => {
    expect(computeSplitElevation([rec({ enhancedAltitude: 200 })])).toEqual({
      gain: 0,
      loss: 0,
    });
  });

  it("accumulates gain for ascending records", () => {
    // 200→210→220→235→250: gain = 10+10+15+15 = 50
    const { gain, loss } = computeSplitElevation(CLIMB_RECORDS);
    expect(gain).toBeCloseTo(50);
    expect(loss).toBeCloseTo(0);
  });

  it("accumulates loss for descending records", () => {
    // 250→240→225→210→200: loss = 10+15+15+10 = 50
    const { gain, loss } = computeSplitElevation(DESCENT_RECORDS);
    expect(gain).toBeCloseTo(0);
    expect(loss).toBeCloseTo(50);
  });

  it("splits gain and loss for mixed elevation", () => {
    const records = [
      rec({ enhancedAltitude: 200 }),
      rec({ enhancedAltitude: 220 }), // +20
      rec({ enhancedAltitude: 210 }), // -10
      rec({ enhancedAltitude: 230 }), // +20
    ];
    const { gain, loss } = computeSplitElevation(records);
    expect(gain).toBeCloseTo(40);
    expect(loss).toBeCloseTo(10);
  });

  it("skips transitions where either record has no altitude", () => {
    const records = [
      rec({ enhancedAltitude: 200 }),
      rec({}),                          // no altitude — transition skipped
      rec({ enhancedAltitude: 250 }),
    ];
    // Only the delta between rec[1] (null) and adjacent records is skipped.
    // The 200→null and null→250 deltas are both skipped.
    const { gain, loss } = computeSplitElevation(records);
    expect(gain).toBeCloseTo(0);
    expect(loss).toBeCloseTo(0);
  });
});
