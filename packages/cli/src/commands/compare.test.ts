import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PROFILE, formatResult } from "@run2max/engine";
import command from "./compare.js";

// Integration guard for the whole Run Comparison vertical: drive the real
// `run2max compare` command against real serialized Analysis Artifacts on disk,
// exercising the loader (Slice 1/2) and the formatter policy (Slice 3) together
// — not mocks. Fixtures are produced by the actual yaml writer via
// `formatResult`, never hand-built artifact strings.

// The public `AnalysisResult` shape, taken from the exported writer's signature
// so the test stays tied to the real type without a deep import.
type AnalysisResult = Parameters<typeof formatResult>[0];

function buildResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    metadata: {
      version: "2.1.0",
      downsample: null,
      anomaliesExcluded: false,
      fileSampleRate: null,
    },
    summary: {
      date: new Date("2026-05-01T07:00:00Z"),
      timezone: "UTC",
      duration: 3600,
      movingTime: 3600,
      distance: 10000,
      avgPower: 250,
      avgPowerZone: "E",
      avgHeartRate: 158,
      avgHeartRatePctLthr: null,
      avgPace: 300,
      maxHeartRate: 176,
      maxPower: null,
      maxPace: null,
      totalAscent: 999,
      totalDescent: null,
      netElevation: null,
      minAltitude: null,
      maxAltitude: null,
      avgHrZone: null,
      avgPaceZone: null,
      normalizedPower: null,
      intensityFactor: null,
      runStressScore: null,
      rpe: 6,
    },
    segments: [],
    kmSplits: [],
    zoneDistribution: [],
    hrZoneDistribution: [],
    paceZoneDistribution: [],
    dynamicsSummary: null,
    elevationProfile: {
      totalAscent: 120,
      totalDescent: 110,
      netElevation: 10,
      minAltitude: 2200,
      maxAltitude: 2320,
      points: [],
    },
    weatherSummary: {
      temperature: 12,
      humidity: 80,
      dewPoint: 8,
      windSpeed: 5,
      windDirection: 180,
      conditions: "Clear",
    },
    weatherPerSplit: [],
    anomalies: [],
    capabilities: { hasRunningDynamics: false, hasStrydEnhanced: false },
    ...overrides,
  } as AnalysisResult;
}

let dir: string;
let writes: string[];

/** Serialize a real AnalysisResult to a yaml artifact in the temp dir. */
async function writeArtifact(name: string, result: AnalysisResult): Promise<string> {
  const path = join(dir, name);
  const { output } = formatResult(result, "yaml", DEFAULT_PROFILE);
  await writeFile(path, output, "utf-8");
  return path;
}

function stdout(): string {
  return writes.join("");
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "run2max-compare-cli-"));
  writes = [];
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    writes.push(String(chunk));
    return true;
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(process, "exit").mockImplementation(((code?: string | number | null) => {
    throw new Error(`EXIT:${code}`);
  }) as never);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("compare command happy path", () => {
  it("renders the full markdown report for two valid artifacts to stdout", async () => {
    const baseline = await writeArtifact(
      "morning-run.yaml",
      buildResult({ summary: { ...buildResult().summary, avgPower: 250 } }),
    );
    const comparand = await writeArtifact(
      "evening-run.yaml",
      buildResult({ summary: { ...buildResult().summary, avgPower: 260 } }),
    );

    await command.run?.({ args: { baseline, comparand } } as never);

    const out = stdout();
    expect(out).toContain("# Run Comparison");
    // Labels are the filenames with the artifact extension stripped.
    expect(out).toContain("- **Baseline:** morning-run");
    expect(out).toContain("- **Comparand:** evening-run");
    expect(out).not.toContain("morning-run.yaml");
    expect(out).not.toContain("evening-run.yaml");
    expect(out).toContain("## Performance");
    expect(out).toContain("## Conditions");
    // Column headers name the actual Runs (filenames, extension stripped).
    expect(out).toMatch(/morning-run .*evening-run/);
    // Real delta computed through the engine: 260 − 250 = +10 W.
    expect(out).toMatch(/Avg Power .*\| .*250 W .*\| .*260 W .*\| .*\+10 W/);
    expect(process.exitCode).not.toBe(1);
  });

  it("degrades conditions per-metric end-to-end when the comparand has no weather", async () => {
    const baseline = await writeArtifact("with-weather.yaml", buildResult());
    const comparand = await writeArtifact(
      "no-weather.yaml",
      buildResult({ weatherSummary: null }),
    );

    await command.run?.({ args: { baseline, comparand } } as never);

    const out = stdout();
    // Weather-dependent metric missing on the comparand only.
    expect(out).toContain("n/a (missing comparand)");
    // Total Ascent survives (from elevationProfile, present on both) with a delta.
    expect(out).toMatch(/Total Ascent .*\| .*120 m .*\| .*120 m .*\| .*0 m/);
    // Performance is unaffected by the missing weather section.
    expect(out).toContain("Avg Power");
    // The comparison does not collapse to fully-unavailable.
    expect(out).not.toContain("missing both");
  });
});

describe("compare command error paths", () => {
  it("fatals naming the baseline when it cannot be read", async () => {
    const comparand = await writeArtifact("good.yaml", buildResult());
    const baseline = join(dir, "does-not-exist.yaml");

    await expect(
      command.run?.({ args: { baseline, comparand } } as never),
    ).rejects.toThrow("EXIT:1");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("baseline"),
    );
    expect(console.error).not.toHaveBeenCalledWith(
      expect.stringContaining("comparand"),
    );
    expect(stdout()).toBe("");
  });

  it("fatals naming the comparand when it cannot be parsed", async () => {
    const baseline = await writeArtifact("good.yaml", buildResult());
    // A valid baseline but an unparseable comparand (broken JSON).
    const comparand = join(dir, "broken.json");
    await writeFile(comparand, "{ this is not json", "utf-8");

    await expect(
      command.run?.({ args: { baseline, comparand } } as never),
    ).rejects.toThrow("EXIT:1");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("comparand"),
    );
    expect(stdout()).toBe("");
  });
});
