import { describe, it, expect } from "vitest";
import { computeSummary } from "./summary.js";
import type { Run2MaxRecord, QuantifyOptions, Run2MaxConfig } from "../types.js";
import type { SessionSummary, WorkoutMetadata } from "normalize-fit-file";

function rec(overrides: Partial<Run2MaxRecord> = {}): Run2MaxRecord {
  return {
    timestamp: new Date(),
    power: 220,
    heartRate: 140,
    cadence: 83,
    strydDistance: 1000,
    distance: 1000,
    ...overrides,
  } as Run2MaxRecord;
}

const SESSION: SessionSummary = {
  totalElapsedTime: 3600,
  totalTimerTime: 3550,
  totalDistance: 10000,
  startTime: new Date("2026-04-12T08:00:00Z"),
};

const METADATA: WorkoutMetadata = {
  timestamp: new Date("2026-04-12T08:00:00Z"),
};

const CONFIG: Run2MaxConfig = {
  zones: [
    { label: "E", name: "Easy", min: 204, max: 233 },
    { label: "M", name: "Marathon", min: 251, max: 260 },
  ],
  thresholds: { lthr: 171 },
};

const OPTIONS: QuantifyOptions = {};

describe("computeSummary", () => {
  it("uses last record strydDistance for total distance", () => {
    const records = [
      rec({ strydDistance: 0 }),
      rec({ strydDistance: 5000 }),
      rec({ strydDistance: 10050 }),
    ];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.distance).toBe(10050); // strydDistance from last record
  });

  it("falls back to session.totalDistance when no records", () => {
    const result = computeSummary([], SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.distance).toBe(10000);
  });

  it("falls back to distance when strydDistance missing", () => {
    const records = [
      rec({ strydDistance: undefined, distance: 9900 }),
    ];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.distance).toBe(9900);
  });

  it("computes duration and movingTime from session", () => {
    const result = computeSummary([rec()], SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.duration).toBe(3600);
    expect(result.movingTime).toBe(3550);
  });

  it("computes avgPower from records", () => {
    const records = [rec({ power: 200 }), rec({ power: 240 })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.avgPower).toBe(220);
  });

  it("classifies avgPower into zone", () => {
    const records = [rec({ power: 220 })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.avgPowerZone).toBe("E");
  });

  it("sets avgPowerZone to null when no config", () => {
    const records = [rec({ power: 220 })];
    const result = computeSummary(records, SESSION, METADATA, undefined, OPTIONS);

    expect(result.avgPowerZone).toBeNull();
  });

  it("computes avgHeartRatePctLthr from thresholds.lthr", () => {
    const records = [rec({ heartRate: 140 })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.avgHeartRatePctLthr).toBeCloseTo((140 / 171) * 100);
  });

  it("falls back to calibration.lthr when thresholds.lthr missing", () => {
    const configWithCalib: Run2MaxConfig = {
      zones: CONFIG.zones,
      calibration: { lthr: 168 },
    };
    const records = [rec({ heartRate: 140 })];
    const result = computeSummary(records, SESSION, METADATA, configWithCalib, OPTIONS);

    expect(result.avgHeartRatePctLthr).toBeCloseTo((140 / 168) * 100);
  });

  it("sets avgHeartRatePctLthr to null when no lthr configured", () => {
    const configNoLthr: Run2MaxConfig = { zones: CONFIG.zones };
    const records = [rec({ heartRate: 140 })];
    const result = computeSummary(records, SESSION, METADATA, configNoLthr, OPTIONS);

    expect(result.avgHeartRatePctLthr).toBeNull();
  });

  it("computes avgPace from movingTime and distance", () => {
    const records = [rec({ strydDistance: 10000 })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    // movingTime=3550, distance=10000m → pace = 3550 / 10 = 355 s/km
    expect(result.avgPace).toBeCloseTo(3550 / 10);
  });

  it("resolves timezone: option > config > UTC", () => {
    // Option overrides
    const withTz: QuantifyOptions = { timezone: "America/New_York" };
    expect(
      computeSummary([rec()], SESSION, METADATA, CONFIG, withTz).timezone,
    ).toBe("America/New_York");

    // Config fallback
    const configWithTz: Run2MaxConfig = {
      ...CONFIG,
      athlete: { timezone: "America/Santiago" },
    };
    expect(
      computeSummary([rec()], SESSION, METADATA, configWithTz, OPTIONS).timezone,
    ).toBe("America/Santiago");

    // UTC default
    expect(
      computeSummary([rec()], SESSION, METADATA, CONFIG, OPTIONS).timezone,
    ).toBe("UTC");
  });

  it("passes through metadata from options", () => {
    const opts: QuantifyOptions = {
      workout: "Build 17: Recovery Run",
      block: "Build Week 04",
      rpe: 2,
      notes: "Easy day",
    };
    const result = computeSummary([rec()], SESSION, METADATA, CONFIG, opts);

    expect(result.workout).toBe("Build 17: Recovery Run");
    expect(result.block).toBe("Build Week 04");
    expect(result.rpe).toBe(2);
    expect(result.notes).toBe("Easy day");
  });

  it("uses metadata.startTime for date", () => {
    const meta: WorkoutMetadata = {
      startTime: new Date("2026-04-12T08:00:00Z"),
      timestamp: new Date("2026-04-12T09:00:00Z"),
    };
    const result = computeSummary([rec()], SESSION, meta, CONFIG, OPTIONS);

    expect(result.date).toEqual(new Date("2026-04-12T08:00:00Z"));
  });

  it("falls back to metadata.timestamp when startTime missing", () => {
    const meta: WorkoutMetadata = {
      timestamp: new Date("2026-04-12T09:00:00Z"),
    };
    const result = computeSummary([rec()], SESSION, meta, CONFIG, OPTIONS);

    expect(result.date).toEqual(new Date("2026-04-12T09:00:00Z"));
  });
});
