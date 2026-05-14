import { describe, it, expect, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
import { parsePlan } from "../plan/schema.js";
import { PrescribedRunOverrideError } from "../plan/associate.js";

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

function makePlanWithPrescribedRuns(options?: {
  firstWeekDate?: string;
  secondWeekDate?: string;
}) {
  const firstWeekDate = options?.firstWeekDate ?? "2026-04-12";
  const secondWeekDate = options?.secondWeekDate ?? "2026-04-13";

  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    start: "2026-04-06",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              {
                planned: "L",
                start: "2026-04-06",
                prescribed_runs: [
                  {
                    local_date: firstWeekDate,
                    label: "Sunday Endurance",
                    prescription: "30min @ E",
                    comparison_group: "endurance",
                  },
                ],
              },
              {
                planned: "LL",
                start: "2026-04-13",
                prescribed_runs: [
                  {
                    local_date: secondWeekDate,
                    label: "Monday Tempo",
                    prescription: "20min @ M[251-260W]",
                    comparison_group: "tempo",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

function makePlanWithoutComparisonGroup() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    start: "2026-04-06",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              {
                planned: "L",
                start: "2026-04-06",
                prescribed_runs: [
                  {
                    local_date: "2026-04-12",
                    label: "Sunday Endurance",
                    prescription: "30min @ E",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

type FileMap = Record<string, string>;

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "run2max-quantify-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function writeFiles(dir: string, files: FileMap): Promise<void> {
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content, "utf-8");
  }
}

const CONFIG: Run2MaxConfig = {
  schemaVersion: 1,
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
    expect(result.metadata.version).toBe("2.0.0");

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
    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments[0].zone).toBeNull();
    expect(result.zoneDistribution).toEqual([]);
    expect(result.kmSplits.length).toBeGreaterThan(0); // km splits don't require zones
  });

  it("adds prescribedRunContext when a prescribed run matches by date", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
    });

    expect(result.prescribedRunContext).toBeDefined();
    expect(result.prescribedRunContext?.matchKind).toBe("date");
    expect(result.prescribedRunContext?.label).toBe("Sunday Endurance");
    expect(result.prescribedRunContext?.localDate).toBe("2026-04-12");
    expect(result.prescribedRunContext?.weekNumber).toBe(1);
  });

  it("adds available prescriptionComparison when prescribed run and lap count match", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
    });

    expect(result.prescribedRunContext).toBeDefined();
    expect(result.prescriptionComparison?.status).toBe("available");
  });

  it("attaches available comparableHistory when comparison group and history inputs exist", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify({
          capturedDate: "2026-04-05",
          comparisonGroup: "endurance",
          prescriptionComparison: {
            actual: {
              duration: 20,
              distance: 45,
              avgPower: 200,
              avgHeartRate: 130,
              maxHeartRate: 145,
              avgPace: 400,
              rpe: 3,
            },
          },
        }),
      });

      const normalized = buildNormalizedData(20);
      vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
      vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

      const plan = makePlanWithPrescribedRuns();
      const result = await quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        fitDirPath: dir,
        currentFitBasename: "run-2",
      });

      expect(result.prescriptionComparison?.status).toBe("available");
      if (result.prescriptionComparison?.status !== "available") {
        throw new Error("expected available comparison");
      }

      expect(result.prescriptionComparison.comparableHistory).toMatchObject({
        status: "available",
      });
      if (result.prescriptionComparison.comparableHistory?.status !== "available") {
        throw new Error("expected available comparable history");
      }

      expect(result.prescriptionComparison.comparableHistory.runs).toHaveLength(1);
      expect(result.prescriptionComparison.comparableHistory.runs[0]).toMatchObject({
        fitBasename: "run-1",
        comparisonGroup: "endurance",
        capturedDate: "2026-04-05",
      });
    });
  });

  it("attaches unavailable comparableHistory when lookup runs with no eligible priors", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.yaml": "captured_date: 2026-04-05",
        "run-1.json": JSON.stringify({
          capturedDate: "2026-04-05",
          comparisonGroup: "endurance",
          prescriptionComparison: {
            actual: {
              duration: 20,
              distance: 45,
              avgPower: 200,
              avgHeartRate: 130,
              maxHeartRate: 145,
              avgPace: 400,
              rpe: 3,
            },
          },
        }),
      });

      const normalized = buildNormalizedData(20);
      vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
      vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

      const plan = makePlanWithPrescribedRuns();
      const result = await quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        fitDirPath: dir,
        currentFitBasename: "run-2",
      });

      expect(result.prescriptionComparison?.status).toBe("available");
      if (result.prescriptionComparison?.status !== "available") {
        throw new Error("expected available comparison");
      }

      expect(result.prescriptionComparison.comparableHistory).toMatchObject({
        status: "unavailable",
        reason: "all_candidates_unavailable",
      });
    });
  });

  it("excludes the current basename from comparableHistory candidates", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify({
          capturedDate: "2026-04-05",
          comparisonGroup: "endurance",
          prescriptionComparison: {
            actual: {
              duration: 20,
              distance: 45,
              avgPower: 200,
              avgHeartRate: 130,
              maxHeartRate: 145,
              avgPace: 400,
              rpe: 3,
            },
          },
        }),
        "run-2.fit": "",
        "run-2.json": JSON.stringify({
          capturedDate: "2026-04-12",
          comparisonGroup: "endurance",
          prescriptionComparison: {
            actual: {
              duration: 20,
              distance: 50,
              avgPower: 210,
              avgHeartRate: 135,
              maxHeartRate: 150,
              avgPace: 390,
              rpe: 4,
            },
          },
        }),
      });

      const normalized = buildNormalizedData(20);
      vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
      vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

      const plan = makePlanWithPrescribedRuns();
      const result = await quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        fitDirPath: dir,
        currentFitBasename: "run-2",
      });

      expect(result.prescriptionComparison?.status).toBe("available");
      if (result.prescriptionComparison?.status !== "available") {
        throw new Error("expected available comparison");
      }
      expect(result.prescriptionComparison.comparableHistory?.status).toBe("available");
      if (result.prescriptionComparison.comparableHistory?.status !== "available") {
        throw new Error("expected available comparable history");
      }

      expect(result.prescriptionComparison.comparableHistory.runs).toHaveLength(1);
      expect(result.prescriptionComparison.comparableHistory.runs[0]?.fitBasename).toBe("run-1");
    });
  });

  it("keeps comparableHistory undefined when prescribed run has no comparison group", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify({
          capturedDate: "2026-04-05",
          comparisonGroup: "endurance",
          prescriptionComparison: {
            actual: {
              duration: 20,
              distance: 45,
              avgPower: 200,
              avgHeartRate: 130,
              maxHeartRate: 145,
              avgPace: 400,
              rpe: 3,
            },
          },
        }),
      });

      const normalized = buildNormalizedData(20);
      vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
      vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

      const plan = makePlanWithoutComparisonGroup();
      const result = await quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        fitDirPath: dir,
        currentFitBasename: "run-2",
      });

      expect(result.prescriptionComparison?.status).toBe("available");
      if (result.prescriptionComparison?.status !== "available") {
        throw new Error("expected available comparison");
      }
      expect(result.prescriptionComparison.comparableHistory).toBeUndefined();
    });
  });

  it("keeps comparableHistory undefined when history inputs are missing", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const resultWithoutDir = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
      currentFitBasename: "run-2",
    });

    expect(resultWithoutDir.prescriptionComparison?.status).toBe("available");
    if (resultWithoutDir.prescriptionComparison?.status !== "available") {
      throw new Error("expected available comparison");
    }
    expect(resultWithoutDir.prescriptionComparison.comparableHistory).toBeUndefined();

    const resultWithoutBasename = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
      fitDirPath: ".",
    });

    expect(resultWithoutBasename.prescriptionComparison?.status).toBe("available");
    if (resultWithoutBasename.prescriptionComparison?.status !== "available") {
      throw new Error("expected available comparison");
    }
    expect(resultWithoutBasename.prescriptionComparison.comparableHistory).toBeUndefined();
  });

  it("keeps comparableHistory undefined when prescriptionComparison is unavailable", async () => {
    const normalized = buildNormalizedData(20);
    normalized.laps = [];
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
      fitDirPath: ".",
      currentFitBasename: "run-2",
    });

    expect(result.prescriptionComparison?.status).toBe("unavailable");
    if (result.prescriptionComparison?.status !== "unavailable") {
      throw new Error("expected unavailable comparison");
    }
    expect((result.prescriptionComparison as { comparableHistory?: unknown }).comparableHistory).toBeUndefined();
  });

  it("keeps prescribedRunContext undefined when no prescribed run matches", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns({ firstWeekDate: "2026-04-11" });
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
    });

    expect(result.planContext).toBeDefined();
    expect(result.planContext?.weekNumber).toBe(1);
    expect(result.prescribedRunContext).toBeUndefined();
    expect(result.prescriptionComparison).toBeUndefined();
  });

  it("adds unavailable missing_laps comparison when prescribed run matches but laps are missing", async () => {
    const normalized = buildNormalizedData(20);
    normalized.laps = [];
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
    });

    expect(result.prescribedRunContext).toBeDefined();
    expect(result.prescriptionComparison).toBeDefined();
    expect(result.prescriptionComparison?.status).toBe("unavailable");
    if (result.prescriptionComparison?.status !== "unavailable") {
      throw new Error("expected unavailable comparison");
    }

    expect(result.prescriptionComparison.reason).toBe("missing_laps");
  });

  it("builds comparison when plan is present even without zone config", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const result = await quantify(new ArrayBuffer(0), {
      plan,
      timezone: "UTC",
    });

    expect(result.segments.length).toBeGreaterThan(0);
    expect(result.segments[0].zone).toBeNull();
    expect(result.prescriptionComparison?.status).toBe("available");
  });

  it("supports cross-week prescribed run override while preserving date-based planContext", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
      prescribedRunOverride: { overrideDate: "2026-04-13" },
    });

    expect(result.planContext).toBeDefined();
    expect(result.planContext?.weekNumber).toBe(1);
    expect(result.prescribedRunContext).toBeDefined();
    expect(result.prescribedRunContext?.matchKind).toBe("override");
    expect(result.prescribedRunContext?.label).toBe("Monday Tempo");
    expect(result.prescribedRunContext?.weekNumber).toBe(2);
  });

  it("throws PrescribedRunOverrideError with no_prescribed_run when explicit date override matches nothing", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns();
    await expect(
      quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        prescribedRunOverride: { overrideDate: "2026-04-15" },
      }),
    ).rejects.toThrow(PrescribedRunOverrideError);

    await expect(
      quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        prescribedRunOverride: { overrideDate: "2026-04-15" },
      }),
    ).rejects.toMatchObject({ reason: "no_prescribed_run" });
  });

  it("throws PrescribedRunOverrideError with ambiguous when explicit label override matches multiple runs", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = parsePlan({
      schema_version: 1,
      block: "build",
      goal: "Half Marathon Santiago",
      start: "2026-04-06",
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            {
              weeks: [
                {
                  planned: "L",
                  start: "2026-04-06",
                  prescribed_runs: [
                    {
                      local_date: "2026-04-12",
                      label: "Sunday Endurance",
                      prescription: "30min @ E",
                    },
                  ],
                },
                {
                  planned: "LL",
                  start: "2026-04-13",
                  prescribed_runs: [
                    {
                      local_date: "2026-04-13",
                      label: "Sunday Endurance",
                      prescription: "30min @ E",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    await expect(
      quantify(new ArrayBuffer(0), {
        config: CONFIG,
        plan,
        timezone: "UTC",
        prescribedRunOverride: { overrideLabel: "Sunday Endurance" },
      }),
    ).rejects.toMatchObject({ reason: "ambiguous" });
  });

  it("does not throw when no override is supplied and association fails — default failure is non-fatal", async () => {
    const normalized = buildNormalizedData(20);
    vi.mocked(parseFitBuffer).mockResolvedValue({} as never);
    vi.mocked(normalizeFFP).mockReturnValue(normalized as never);

    const plan = makePlanWithPrescribedRuns({ firstWeekDate: "2026-04-11" });
    const result = await quantify(new ArrayBuffer(0), {
      config: CONFIG,
      plan,
      timezone: "UTC",
    });

    expect(result.prescribedRunContext).toBeUndefined();
    expect(result.prescriptionComparison).toBeUndefined();
  });
});
