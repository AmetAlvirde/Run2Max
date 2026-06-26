import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE, formatResult } from "../formatters/index.js";
import type { AnalysisResult, OutputFormat } from "../types.js";
import { loadRunComparisonSide } from "./run-comparison.js";

// Round-trip contract: a real serialized `AnalysisResult` (produced by the
// actual yaml/json writers via `formatResult`, not a hand-built record) must
// load back through `parseArtifactFile` + `extractRunComparisonSide` with every
// performance and conditions field mapped. This guards the extractor's tie to
// `RunSummary` / `WeatherSummary` / `ElevationProfile` field names and the
// snake_case-yaml normalization path for both writers.

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "run2max-run-comparison-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const EXT: Record<OutputFormat, string> = {
  yaml: "yaml",
  json: "json",
  markdown: "md",
};

/** Serialize a real AnalysisResult and load it back as one comparison side. */
async function roundTrip(
  result: AnalysisResult,
  format: OutputFormat,
  label = "run",
) {
  let loaded!: Awaited<ReturnType<typeof loadRunComparisonSide>>;
  await withTempDir(async (dir) => {
    const { output } = formatResult(result, format, DEFAULT_PROFILE);
    const path = join(dir, `${label}.${EXT[format]}`);
    await writeFile(path, output, "utf-8");
    loaded = await loadRunComparisonSide(path, label);
  });
  return loaded;
}

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
      // summary.totalAscent deliberately differs from elevationProfile so the
      // extractor's "prefer elevationProfile, fall back to summary" is testable.
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
  };
}

const FORMATS: OutputFormat[] = ["yaml", "json"];

describe.each(FORMATS)("loadRunComparisonSide round-trip (%s)", (format) => {
  it("maps every performance and conditions field of a full artifact", async () => {
    const side = await roundTrip(buildResult(), format, "full");

    expect(side.label).toBe("full");
    expect(side.performance).toEqual({
      duration: 3600,
      distance: 10000,
      avgPower: 250,
      avgHeartRate: 158,
      maxHeartRate: 176,
      avgPace: 300,
      rpe: 6,
    });
    expect(side.conditions).toEqual({
      temperature: 12,
      windSpeed: 5,
      totalAscent: 120, // from elevationProfile, not summary's 999
      humidity: 80,
      dewPoint: 8,
    });
    expect(side.context).toEqual({ conditions: "Clear", windDirection: 180 });
  });

  it("degrades all conditions when the weather section is absent", async () => {
    const side = await roundTrip(
      buildResult({ weatherSummary: null }),
      format,
      "no-weather",
    );

    expect(side.conditions).toEqual({
      temperature: null,
      windSpeed: null,
      totalAscent: 120, // elevation still present
      humidity: null,
      dewPoint: null,
    });
    expect(side.context).toEqual({ conditions: null, windDirection: null });
    // Performance is unaffected by missing weather.
    expect(side.performance.avgPower).toBe(250);
  });

  it("falls back to summary totalAscent when elevation is absent", async () => {
    const side = await roundTrip(
      buildResult({ elevationProfile: null }),
      format,
      "no-elevation",
    );

    expect(side.conditions.totalAscent).toBe(999); // summary fallback
    expect(side.conditions.temperature).toBe(12); // weather still present
  });

  it("round-trips a populated rpe", async () => {
    const side = await roundTrip(
      buildResult({ summary: { ...buildResult().summary, rpe: 9 } }),
      format,
      "rpe",
    );

    expect(side.performance.rpe).toBe(9);
  });
});
