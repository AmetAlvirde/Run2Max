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
  powerZones: [
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
      powerZones: CONFIG.powerZones,
      calibration: { lthr: 168 },
    };
    const records = [rec({ heartRate: 140 })];
    const result = computeSummary(records, SESSION, METADATA, configWithCalib, OPTIONS);

    expect(result.avgHeartRatePctLthr).toBeCloseTo((140 / 168) * 100);
  });

  it("sets avgHeartRatePctLthr to null when no lthr configured", () => {
    const configNoLthr: Run2MaxConfig = { powerZones: CONFIG.powerZones };
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

  // ---------------------------------------------------------------------------
  // Max values
  // ---------------------------------------------------------------------------

  it("computes maxHeartRate as single-record max", () => {
    const records = [
      rec({ heartRate: 140 }),
      rec({ heartRate: 165 }),
      rec({ heartRate: 158 }),
    ];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.maxHeartRate).toBe(165);
  });

  it("returns null maxHeartRate when no records have heartRate", () => {
    const records = [rec({ heartRate: undefined }), rec({ heartRate: undefined })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.maxHeartRate).toBeNull();
  });

  it("computes maxPower as 5s rolling window peak", () => {
    // 5 steady records + 1 spike → peak window includes the spike
    const records = [
      rec({ power: 200 }), rec({ power: 200 }), rec({ power: 200 }),
      rec({ power: 200 }), rec({ power: 200 }), rec({ power: 280 }),
    ];
    // Windows of 5: [200,200,200,200,200]=200, [200,200,200,200,280]=216
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.maxPower).toBeCloseTo(216);
  });

  it("returns null maxPower when no power data", () => {
    const records = [rec({ power: undefined }), rec({ power: undefined })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.maxPower).toBeNull();
  });

  it("computes maxPace as 5s rolling window fastest pace", () => {
    // speed → pace: 1000/speed. Lower sec/km = faster.
    // rollingWindowMin finds the window with lowest avg sec/km = fastest pace.
    const records = [
      rec({ speed: 2.5 }),   // 400 s/km
      rec({ speed: 2.5 }),
      rec({ speed: 2.5 }),
      rec({ speed: 2.5 }),
      rec({ speed: 2.5 }),
      rec({ speed: 4.0 }),   // 250 s/km — fast record in window
    ];
    // Windows of 5: [400×5]=400, [400,400,400,400,250]=370
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.maxPace).toBeCloseTo((400 * 4 + 250) / 5);
  });

  it("returns null maxPace when no speed data", () => {
    const records = [rec({ speed: undefined }), rec({ speed: undefined })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.maxPace).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Elevation stats
  // ---------------------------------------------------------------------------

  it("uses session totalAscent/totalDescent for elevation", () => {
    const sessionWithElev: SessionSummary = {
      ...SESSION,
      totalAscent: 150,
      totalDescent: 120,
    };
    const records = [
      rec({ enhancedAltitude: 200 }),
      rec({ enhancedAltitude: 250 }),
    ];
    const result = computeSummary(records, sessionWithElev, METADATA, CONFIG, OPTIONS);

    expect(result.totalAscent).toBe(150);
    expect(result.totalDescent).toBe(120);
    expect(result.netElevation).toBe(30);
    expect(result.minAltitude).toBe(200);
    expect(result.maxAltitude).toBe(250);
  });

  it("computes elevation from record deltas when session values absent", () => {
    const records = [
      rec({ enhancedAltitude: 200 }),
      rec({ enhancedAltitude: 220 }), // +20
      rec({ enhancedAltitude: 215 }), // -5
    ];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.totalAscent).toBeCloseTo(20);
    expect(result.totalDescent).toBeCloseTo(5);
    expect(result.netElevation).toBeCloseTo(15);
    expect(result.minAltitude).toBe(200);
    expect(result.maxAltitude).toBe(220);
  });

  it("returns null elevation stats when no altitude data in records", () => {
    const result = computeSummary([rec()], SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.totalAscent).toBeNull();
    expect(result.totalDescent).toBeNull();
    expect(result.netElevation).toBeNull();
    expect(result.minAltitude).toBeNull();
    expect(result.maxAltitude).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // avgHrZone and avgPaceZone
  // ---------------------------------------------------------------------------

  it("computes avgHrZone when hrZones configured", () => {
    const configWithHr: Run2MaxConfig = {
      ...CONFIG,
      hrZones: [
        { label: "Z1", name: "Recovery", min: 0, max: 127 },
        { label: "Z2", name: "Aerobic", min: 128, max: 152 },
        { label: "Z3", name: "Tempo", min: 153, max: 166 },
      ],
    };
    const records = [rec({ heartRate: 140 }), rec({ heartRate: 144 })];
    const result = computeSummary(records, SESSION, METADATA, configWithHr, OPTIONS);

    expect(result.avgHrZone).toBe("Z2"); // avg HR = 142, in Z2 range
  });

  it("sets avgHrZone to null when hrZones not configured", () => {
    const records = [rec({ heartRate: 140 })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.avgHrZone).toBeNull();
  });

  it("computes avgPaceZone when paceZones configured", () => {
    // avgPace = movingTime / (distance / 1000) = 3550 / 10 = 355 s/km
    // → put that in a pace zone
    const configWithPace: Run2MaxConfig = {
      ...CONFIG,
      paceZones: [
        { label: "Z2", name: "Aerobic", min: 330, max: 390 },
        { label: "Z3", name: "Tempo", min: 285, max: 330 },
      ],
    };
    const records = [rec({ strydDistance: 10000 })];
    const result = computeSummary(records, SESSION, METADATA, configWithPace, OPTIONS);

    // avgPace = 3550 / 10 = 355 → Z2 (330–390)
    expect(result.avgPaceZone).toBe("Z2");
  });

  it("sets avgPaceZone to null when paceZones not configured", () => {
    const records = [rec({ strydDistance: 10000 })];
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.avgPaceZone).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Normalized Power, Intensity Factor, Run Stress Score
  // ---------------------------------------------------------------------------

  it("returns null normalizedPower when fewer than 30 records", () => {
    const records = Array.from({ length: 10 }, () => rec({ power: 220 }));
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.normalizedPower).toBeNull();
  });

  it("computes normalizedPower equal to avg power for constant output", () => {
    // Constant power → rolling avg = constant → NP = constant
    const records = Array.from({ length: 60 }, () => rec({ power: 240 }));
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.normalizedPower).toBeCloseTo(240);
  });

  it("computes intensityFactor as NP / criticalPower", () => {
    const cp = 290;
    const configWithCp: Run2MaxConfig = {
      ...CONFIG,
      calibration: { criticalPower: cp },
    };
    const records = Array.from({ length: 60 }, () => rec({ power: 240 }));
    const result = computeSummary(records, SESSION, METADATA, configWithCp, OPTIONS);

    expect(result.intensityFactor).toBeCloseTo(240 / 290);
  });

  it("returns null intensityFactor when no criticalPower configured", () => {
    const records = Array.from({ length: 60 }, () => rec({ power: 240 }));
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.intensityFactor).toBeNull();
  });

  it("computes runStressScore from NP, IF, movingTime, and CP", () => {
    const cp = 290;
    const np = 240;
    const configWithCp: Run2MaxConfig = {
      ...CONFIG,
      calibration: { criticalPower: cp },
    };
    const records = Array.from({ length: 60 }, () => rec({ power: np }));
    // movingTime = SESSION.totalTimerTime = 3550
    // IF = 240/290, RSS = (3550 * 240 * (240/290)) / (290 * 3600) * 100
    const expectedRss = (3550 * np * (np / cp)) / (cp * 3600) * 100;
    const result = computeSummary(records, SESSION, METADATA, configWithCp, OPTIONS);

    expect(result.runStressScore).toBeCloseTo(expectedRss);
  });

  it("returns null runStressScore when no criticalPower configured", () => {
    const records = Array.from({ length: 60 }, () => rec({ power: 240 }));
    const result = computeSummary(records, SESSION, METADATA, CONFIG, OPTIONS);

    expect(result.runStressScore).toBeNull();
  });
});
