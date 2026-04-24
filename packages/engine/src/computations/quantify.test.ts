import { describe, it, expect, vi } from "vitest";
import type { Run2MaxConfig } from "../types.js";

// Mock normalize-fit-file to avoid needing real .fit files
vi.mock("normalize-fit-file", () => ({
  parseFitBuffer: vi.fn(),
  normalizeFFP: vi.fn(),
  downsampleRecords: vi.fn((records: unknown[], n: number) => {
    // Simple mock: keep every Nth record
    return (records as unknown[]).filter((_, i) => i % n === 0);
  }),
}));

import { parseFitBuffer, normalizeFFP } from "normalize-fit-file";
import { quantify } from "./quantify.js";

const BASE_TIME = new Date("2026-04-12T08:00:00Z");
function ms(seconds: number): Date {
  return new Date(BASE_TIME.getTime() + seconds * 1000);
}

function buildNormalizedData(recordCount: number) {
  const records = Array.from({ length: recordCount }, (_, i) => ({
    timestamp: ms(i),
    power: 220,
    heartRate: i < 3 ? 0 : 140, // first 3 records have HR=0
    cadence: 83,
    speed: 2.5,
    distance: i * 2.5,
    strydDistance: i * 2.5,
    stanceTime: 350,
    stepLength: 900,
    verticalOscillation: 45,
    formPower: 60,
    airPower: 5,
    legSpringStiffness: 9.0,
  }));

  return {
    metadata: {
      sport: "running",
      startTime: BASE_TIME,
      timestamp: BASE_TIME,
    },
    deviceInfo: [],
    session: {
      totalElapsedTime: recordCount,
      totalTimerTime: recordCount,
      totalDistance: recordCount * 2.5,
      avgHeartRate: 140,
      avgPower: 220,
    },
    laps: [
      {
        lapIndex: 0,
        startTime: ms(0),
        timestamp: ms(recordCount - 1),
        totalElapsedTime: recordCount,
        totalDistance: recordCount * 2.5,
      },
    ],
    records,
  };
}

const CONFIG: Run2MaxConfig = {
  powerZones: [
    { label: "E", name: "Easy", min: 204, max: 233 },
    { label: "M", name: "Marathon", min: 251, max: 260 },
  ],
  thresholds: { lthr: 171 },
};

describe("quantify", () => {
  it("returns a complete AnalysisResult", async () => {
    const normalized = buildNormalizedData(100);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const result = await quantify(new ArrayBuffer(0), { config: CONFIG });

    // Summary
    expect(result.summary.duration).toBe(100);
    expect(result.summary.avgPower).toBeCloseTo(220);
    expect(result.summary.avgPowerZone).toBe("E");
    expect(result.summary.avgHeartRatePctLthr).toBeDefined();
    expect(result.summary.timezone).toBe("UTC");

    // Segments
    expect(result.segments.length).toBeGreaterThan(0);

    // Km splits
    expect(result.kmSplits.length).toBeGreaterThan(0);

    // Zone distribution
    expect(result.zoneDistribution.length).toBeGreaterThanOrEqual(2);
    const totalPct = result.zoneDistribution.reduce(
      (sum, z) => sum + z.percentage,
      0,
    );
    expect(totalPct).toBeCloseTo(100);

    // Dynamics
    expect(result.dynamicsSummary).not.toBeNull();
    expect(result.dynamicsSummary!.avgStanceTime).toBe(350);
    expect(result.dynamicsSummary!.avgFormPowerRatio).toBeCloseTo(60 / 220);

    // Capabilities
    expect(result.capabilities.hasRunningDynamics).toBe(true);
    expect(result.capabilities.hasStrydEnhanced).toBe(true);

    // Metadata version
    expect(result.metadata.version).toBe("1.0.0");

    // Anomalies (first 3 records have HR=0)
    expect(result.anomalies.length).toBeGreaterThan(0);
    expect(result.anomalies[0].field).toBe("heartRate");
    expect(result.anomalies[0].excluded).toBe(false);
  });

  it("excludes anomalies when option set", async () => {
    const normalized = buildNormalizedData(100);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      excludeAnomalies: true,
    });

    // Anomalies should be marked as excluded
    expect(result.anomalies[0].excluded).toBe(true);

    // Avg HR should not include the 0 values
    expect(result.summary.avgHeartRate).toBe(140);
  });

  it("downsamples records when option set", async () => {
    const normalized = buildNormalizedData(100);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      downsample: 10,
    });

    // With 100 records downsampled by 10, we get ~10 records
    // Zone distribution should use 10s intervals
    expect(result.zoneDistribution.length).toBeGreaterThan(0);
    const totalSeconds = result.zoneDistribution.reduce(
      (sum, z) => sum + z.seconds,
      0,
    );
    // 10 records * 10s interval = 100s (some may be excluded due to null power)
    expect(totalSeconds).toBeGreaterThan(0);
  });

  it("passes through metadata from options", async () => {
    const normalized = buildNormalizedData(10);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      workout: "Recovery Run",
      block: "Build Week 04",
      rpe: 2,
      notes: "Easy day",
    });

    expect(result.summary.workout).toBe("Recovery Run");
    expect(result.summary.block).toBe("Build Week 04");
    expect(result.summary.rpe).toBe(2);
    expect(result.summary.notes).toBe("Easy day");
  });

  it("works without config (no zones, no LTHR)", async () => {
    const normalized = buildNormalizedData(10);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const result = await quantify(new ArrayBuffer(0));

    expect(result.summary.avgPowerZone).toBeNull();
    expect(result.summary.avgHeartRatePctLthr).toBeNull();
    expect(result.segments).toEqual([]);
    expect(result.zoneDistribution).toEqual([]);
    expect(result.kmSplits.length).toBeGreaterThan(0); // km splits don't require zones
  });
});
