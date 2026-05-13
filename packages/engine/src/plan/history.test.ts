import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { PrescriptionComparisonRunActuals } from "../types.js";
import { readHistoryArtifacts } from "./history.js";

type FileMap = Record<string, string>;

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "run2max-history-test-"));
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

function validJsonArtifact(overrides?: Partial<Record<string, unknown>>): string {
  const base = {
    capturedDate: "2026-05-01",
    comparisonGroup: "Tuesday Intervals",
    prescriptionComparison: {
      actual: {
        duration: 3600,
        distance: 10000,
        avgPower: 250,
        avgHeartRate: 162,
        maxHeartRate: 178,
        avgPace: 300,
        rpe: 7,
      },
    },
  };
  return JSON.stringify({ ...base, ...overrides }, null, 2);
}

describe("readHistoryArtifacts", () => {
  it("returns no_candidates for a missing directory", async () => {
    await expect(
      readHistoryArtifacts({
        blockDirPath: "/path/that/does/not/exist",
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      }),
    ).resolves.toEqual({ candidates: [], topLevelReason: "no_candidates" });
  });

  it("discovers paired YAML artifact and normalizes snake_case keys", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.yaml": [
          "captured_date: 2026-05-01",
          "comparison_group: Tuesday Intervals",
          "prescription_comparison:",
          "  actual:",
          "    duration: 3600",
          "    distance: 10000",
          "    avg_power: 250",
          "    avg_heart_rate: 162",
          "    max_heart_rate: 178",
          "    avg_pace: 300",
          "    rpe: 7",
        ].join("\n"),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.topLevelReason).toBeUndefined();
      expect(report.candidates).toHaveLength(1);
      expect(report.candidates[0]).toMatchObject({
        status: "eligible",
        fitBasename: "run-1",
        format: "yaml",
        capturedDate: "2026-05-01",
        comparisonGroup: "Tuesday Intervals",
        actual: {
          duration: 3600,
          distance: 10000,
          avgPower: 250,
          avgHeartRate: 162,
          maxHeartRate: 178,
          avgPace: 300,
          rpe: 7,
        },
      });
    });
  });

  it("discovers paired JSON artifact", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": validJsonArtifact(),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates).toHaveLength(1);
      expect(report.candidates[0]).toMatchObject({
        status: "eligible",
        fitBasename: "run-1",
        format: "json",
      });
    });
  });

  it("excludes current basename", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": validJsonArtifact({ capturedDate: "2026-04-20" }),
        "run-2.fit": "",
        "run-2.json": validJsonArtifact({ capturedDate: "2026-05-01" }),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates).toHaveLength(1);
      expect(report.candidates[0]).toMatchObject({ fitBasename: "run-1" });
    });
  });

  it("ignores unpaired stray artifacts", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": validJsonArtifact(),
        "lonely-file.yaml": "captured_date: 2026-05-01",
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates).toHaveLength(1);
      expect(report.candidates[0]).toMatchObject({ fitBasename: "run-1" });
    });
  });

  it("rejects same-basename yaml/json artifacts as ambiguous", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.yaml": "captured_date: 2026-05-01",
        "run-1.json": validJsonArtifact(),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.topLevelReason).toBe("all_candidates_unavailable");
      expect(report.candidates).toHaveLength(1);
      expect(report.candidates[0]).toMatchObject({
        status: "unavailable",
        fitBasename: "run-1",
        reason: "ambiguous_artifact",
        format: "unknown",
      });
      expect((report.candidates[0] as { sourcePath: string[] }).sourcePath).toHaveLength(2);
    });
  });

  it("marks mismatched comparisonGroup as unavailable", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": validJsonArtifact({ comparisonGroup: "Saturday Long" }),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.topLevelReason).toBe("all_candidates_unavailable");
      expect(report.candidates[0]).toMatchObject({
        status: "unavailable",
        reason: "comparison_group_mismatch",
      });
    });
  });

  it("marks missing capturedDate as partial_artifact", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": validJsonArtifact({ capturedDate: undefined }),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates[0]).toMatchObject({
        status: "unavailable",
        reason: "partial_artifact",
        missingFields: ["capturedDate"],
      });
    });
  });

  it("marks artifacts with no metric actuals as partial_artifact", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify(
          {
            capturedDate: "2026-05-01",
            comparisonGroup: "Tuesday Intervals",
            prescriptionComparison: {
              actual: {
                duration: 3600,
                distance: 10000,
              },
            },
          },
          null,
          2,
        ),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates[0]).toMatchObject({
        status: "unavailable",
        reason: "partial_artifact",
        missingFields: ["avgPower", "avgHeartRate", "maxHeartRate", "avgPace", "rpe"],
      });
    });
  });

  it("treats snake_case JSON keys as missing required fields", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify(
          {
            captured_date: "2026-05-01",
            comparison_group: "Tuesday Intervals",
            prescription_comparison: {
              actual: {
                duration: 3600,
                distance: 10000,
                avg_power: 250,
              },
            },
          },
          null,
          2,
        ),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates[0]).toMatchObject({
        status: "unavailable",
        reason: "partial_artifact",
      });
      expect((report.candidates[0] as { missingFields?: string[] }).missingFields).toEqual(
        expect.arrayContaining(["capturedDate", "comparisonGroup", "avgPower"]),
      );
    });
  });

  it("prioritizes partial_artifact before comparison-group filtering", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify(
          {
            capturedDate: "2026-05-01",
            comparisonGroup: "Saturday Long",
            prescriptionComparison: {
              actual: {
                duration: 3600,
                distance: 10000,
              },
            },
          },
          null,
          2,
        ),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates[0]).toMatchObject({
        status: "unavailable",
        reason: "partial_artifact",
      });
    });
  });

  it("marks unparseable YAML and continues processing siblings", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.yaml": "captured_date: [bad",
        "run-2.fit": "",
        "run-2.json": validJsonArtifact(),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-3",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates).toHaveLength(2);
      expect(report.candidates[0]).toMatchObject({
        fitBasename: "run-1",
        status: "unavailable",
        reason: "unparseable_artifact",
      });
      expect(report.candidates[1]).toMatchObject({
        fitBasename: "run-2",
        status: "eligible",
      });
    });
  });

  it("marks unparseable JSON and continues processing siblings", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": "{ bad json",
        "run-2.fit": "",
        "run-2.json": validJsonArtifact(),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-3",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates).toHaveLength(2);
      expect(report.candidates[0]).toMatchObject({
        fitBasename: "run-1",
        status: "unavailable",
        reason: "unparseable_artifact",
      });
      expect(report.candidates[1]).toMatchObject({
        fitBasename: "run-2",
        status: "eligible",
      });
    });
  });

  it("returns no_candidates for an empty directory", async () => {
    await withTempDir(async (dir) => {
      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report).toEqual({ candidates: [], topLevelReason: "no_candidates" });
    });
  });

  it("returns all_candidates_unavailable when every candidate is unavailable", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": validJsonArtifact({ comparisonGroup: "Saturday Long" }),
        "run-2.fit": "",
        "run-2.json": JSON.stringify(
          {
            capturedDate: "2026-05-01",
            comparisonGroup: "Tuesday Intervals",
            prescriptionComparison: { actual: { duration: 3600, distance: 10000 } },
          },
          null,
          2,
        ),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-3",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.topLevelReason).toBe("all_candidates_unavailable");
      expect(report.candidates).toHaveLength(2);
    });
  });

  it("throws on empty currentFitBasename", async () => {
    await expect(
      readHistoryArtifacts({
        blockDirPath: "/tmp",
        currentFitBasename: "",
        comparisonGroup: "Tuesday Intervals",
      }),
    ).rejects.toThrow("currentFitBasename must be non-empty");
  });

  it("throws on empty comparisonGroup", async () => {
    await expect(
      readHistoryArtifacts({
        blockDirPath: "/tmp",
        currentFitBasename: "run-1",
        comparisonGroup: "",
      }),
    ).rejects.toThrow("comparisonGroup must be non-empty");
  });

  it("preserves explicit null metric fields in eligible actual payload", async () => {
    await withTempDir(async (dir) => {
      await writeFiles(dir, {
        "run-1.fit": "",
        "run-1.json": JSON.stringify(
          {
            capturedDate: "2026-05-01",
            comparisonGroup: "Tuesday Intervals",
            prescriptionComparison: {
              actual: {
                duration: 3600,
                distance: 10000,
                avgPower: 250,
                avgHeartRate: null,
                maxHeartRate: null,
                avgPace: null,
                rpe: 7,
              },
            },
          },
          null,
          2,
        ),
      });

      const report = await readHistoryArtifacts({
        blockDirPath: dir,
        currentFitBasename: "run-2",
        comparisonGroup: "Tuesday Intervals",
      });

      expect(report.candidates[0]).toMatchObject({
        status: "eligible",
        actual: {
          avgPower: 250,
          avgHeartRate: null,
          maxHeartRate: null,
          avgPace: null,
          rpe: 7,
        },
      });

      const actual = (report.candidates[0] as { actual: PrescriptionComparisonRunActuals }).actual;
      expect(actual.distance).toBe(10000);
    });
  });

  it("exports readHistoryArtifacts from @run2max/engine", async () => {
    const engine = await import("../index.js");
    expect(typeof engine.readHistoryArtifacts).toBe("function");
  });
});
