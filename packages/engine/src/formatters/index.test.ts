import { describe, it, expect } from "vitest";
import { parse as parseYaml } from "yaml";
import type {
  AnalysisResult,
  SectionId,
  ColumnId,
} from "../types.js";
import { formatResult, DEFAULT_PROFILE } from "./index.js";

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

const BASE_DATE = new Date("2026-04-12T08:20:00Z"); // Sunday in UTC

function buildResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    metadata: {
      version: "2.1.0",
      downsample: null,
      anomaliesExcluded: false,
      fileSampleRate: null,
    },
    summary: {
      date: BASE_DATE,
      timezone: "UTC",
      duration: 7402,   // 2:03:22
      movingTime: 7402,
      distance: 18080,  // 18.08 km
      avgPower: 224,
      avgPowerZone: "E",
      avgHeartRate: 140,
      avgHeartRatePctLthr: 81.9,
      avgPace: 409,     // 6:49/km
      maxHeartRate: null,
      maxPower: null,
      maxPace: null,
      totalAscent: null,
      totalDescent: null,
      netElevation: null,
      minAltitude: null,
      maxAltitude: null,
      avgHrZone: null,
      avgPaceZone: null,
      normalizedPower: null,
      intensityFactor: null,
      runStressScore: null,
      workout: "Recovery Run",
      block: "Build Week 04",
      rpe: 2,
      notes: "Easy day.",
    },
    segments: [
      {
        lapIndex: 0,
        distance: 9040,
        duration: 3701,
        avgPower: 220,
        zone: "E",
        avgPace: 410,
        avgHeartRate: 138,
        avgCadence: 83,
        avgStanceTime: 350,
        avgStanceTimeBalance: 49.8,
        avgStepLength: 850,
        avgVerticalOscillation: 47,
        formPowerRatio: 0.34,
        verticalRatio: 6.8,
        elevGain: null,
        elevLoss: null,
        avgAirPower: null,
        windSpeed: null,
        windDirection: null,
        temperature: null,
      },
      {
        lapIndex: 1,
        distance: 9040,
        duration: 3701,
        avgPower: 228,
        zone: "E",
        avgPace: 408,
        avgHeartRate: 142,
        avgCadence: 84,
        avgStanceTime: 348,
        avgStanceTimeBalance: 49.9,
        avgStepLength: 855,
        avgVerticalOscillation: 46,
        formPowerRatio: 0.33,
        verticalRatio: 6.7,
        elevGain: null,
        elevLoss: null,
        avgAirPower: null,
        windSpeed: null,
        windDirection: null,
        temperature: null,
      },
    ],
    kmSplits: [
      {
        km: 1,
        distance: 1000,
        duration: 409,
        avgPower: 222,
        zone: "E",
        avgPace: 409,
        avgHeartRate: 139,
        avgCadence: 83,
        avgStanceTime: 350,
        avgStanceTimeBalance: 49.8,
        avgStepLength: 850,
        avgVerticalOscillation: 47,
        formPowerRatio: 0.34,
        verticalRatio: 6.8,
        elevGain: null,
        elevLoss: null,
        avgAirPower: null,
        windSpeed: null,
        windDirection: null,
        temperature: null,
      },
    ],
    zoneDistribution: [
      { label: "E", name: "Easy",     seconds: 7106, percentage: 96.0 },
      { label: "M", name: "Marathon", seconds: 148,  percentage: 2.0  },
      { label: "I", name: "Interval", seconds: 0,    percentage: 0.0  }, // must be omitted
    ],
    hrZoneDistribution: [],
    paceZoneDistribution: [],
    elevationProfile: null,
    weatherSummary: null,
    weatherPerSplit: [],
    dynamicsSummary: {
      avgStanceTime: 350,
      avgStanceTimeBalance: 49.8,
      avgStepLength: 850,
      avgVerticalOscillation: 47,
      avgVerticalOscillationBalance: 49.6,
      avgFormPower: 62,
      avgAirPower: 8,
      avgLegSpringStiffness: 9.0,
      avgLegSpringStiffnessBalance: 49.2,
      avgFormPowerRatio: 0.34,
      avgVerticalRatio: 6.8,
    },
    anomalies: [
      {
        type: "zero_value",
        field: "heartRate",
        description: "heartRate=0 for 10s at 0:00-0:09",
        affectedRecords: 10,
        excluded: false,
      },
      {
        type: "zero_value",
        field: "legSpringStiffness",
        description: "legSpringStiffness=0 for 3s at 1:00-1:02",
        affectedRecords: 3,
        excluded: true,
      },
    ],
    capabilities: {
      hasRunningDynamics: true,
      hasStrydEnhanced: true,
    },
    ...overrides,
  };
}

function buildAvailableComparison(): NonNullable<AnalysisResult["prescriptionComparison"]> {
  return {
    status: "available",
    prescribedRun: {
      label: "4x5min",
      localDate: "2026-04-12",
      comparisonGroup: "threshold_5min",
      matchKind: "date",
      weekNumber: 4,
      weekType: "L",
    },
    actual: {
      duration: 7402,
      distance: 18080,
      avgPower: 224,
      avgHeartRate: 140,
      maxHeartRate: 165,
      avgPace: 409,
      rpe: 2,
    },
    steps: [
      {
        index: 0,
        prescribed: {
          source: "5min@SUB-T",
          target: { kind: "duration", value: 300, unit: "seconds" },
          intensityLabel: "SUB-T",
          targetRange: { metric: "power", min: 289, max: 301, unit: "W" },
        },
        actual: {
          lapIndex: 0,
          distance: 1510,
          duration: 300,
          avgPower: 295,
          avgHeartRate: 155,
          avgPace: 238,
        },
        completion: {
          targetKind: "duration",
          prescribedValue: 300,
          actualValue: 300,
          delta: 0,
          ratio: 1,
          status: "within_tolerance",
          tolerance: { lower: 285, upper: 315 },
        },
        power: {
          status: "within",
          actualAvgPower: 295,
          targetRange: { metric: "power", min: 289, max: 301, unit: "W" },
          deltaToMin: 6,
          deltaToMax: -6,
        },
      },
    ],
  };
}

function buildUnavailableComparison(): NonNullable<AnalysisResult["prescriptionComparison"]> {
  return {
    status: "unavailable",
    reason: "step_count_mismatch",
    prescribedRun: {
      label: "4x5min",
      localDate: "2026-04-12",
      comparisonGroup: "threshold_5min",
      matchKind: "date",
      weekNumber: 4,
      weekType: "L",
    },
    prescribedStepCount: 8,
    actualSegmentCount: 7,
  };
}

function buildComparableHistoryAvailableComparison(): NonNullable<AnalysisResult["prescriptionComparison"]> {
  const comparison = buildAvailableComparison();
  if (comparison.status !== "available") {
    throw new Error("expected available comparison fixture");
  }

  return {
    ...comparison,
    comparableHistory: {
      status: "available",
      runs: [
        {
          sourcePath: "/tmp/block/run-1.json",
          fitBasename: "run-1",
          capturedDate: "2026-04-05",
          comparisonGroup: "threshold_5min",
          metrics: [
            { metric: "avgPower", status: "available", current: 224, prior: 200, delta: 24 },
            { metric: "avgHeartRate", status: "available", current: 140, prior: 132, delta: 8 },
            { metric: "maxHeartRate", status: "available", current: 165, prior: 160, delta: 5 },
            { metric: "avgPace", status: "available", current: 409, prior: 420, delta: -11 },
            { metric: "rpe", status: "available", current: 2, prior: 3, delta: -1 },
          ],
        },
      ],
    },
  };
}

function buildComparableHistoryWithMissingPriorRpeComparison(): NonNullable<AnalysisResult["prescriptionComparison"]> {
  const comparison = buildComparableHistoryAvailableComparison();
  if (comparison.status !== "available" || !comparison.comparableHistory || comparison.comparableHistory.status !== "available") {
    throw new Error("expected available comparable history fixture");
  }

  return {
    ...comparison,
    comparableHistory: {
      ...comparison.comparableHistory,
      runs: [
        {
          ...comparison.comparableHistory.runs[0]!,
          metrics: [
            { metric: "avgPower", status: "available", current: 224, prior: 200, delta: 24 },
            { metric: "avgHeartRate", status: "available", current: 140, prior: 132, delta: 8 },
            { metric: "maxHeartRate", status: "available", current: 165, prior: 160, delta: 5 },
            { metric: "avgPace", status: "available", current: 409, prior: 420, delta: -11 },
            {
              metric: "rpe",
              status: "unavailable",
              current: 2,
              prior: null,
              reason: "missing_prior_value",
            },
          ],
        },
      ],
    },
  };
}

function buildComparableHistoryUnavailableComparison(): NonNullable<AnalysisResult["prescriptionComparison"]> {
  const comparison = buildAvailableComparison();
  if (comparison.status !== "available") {
    throw new Error("expected available comparison fixture");
  }

  return {
    ...comparison,
    comparableHistory: {
      status: "unavailable",
      reason: "all_candidates_unavailable",
      candidates: [
        {
          status: "unavailable",
          sourcePath: ["/tmp/block/run-1.yaml", "/tmp/block/run-1.json"],
          format: "unknown",
          fitBasename: "run-1",
          reason: "ambiguous_artifact",
        },
        {
          status: "unavailable",
          sourcePath: "/tmp/block/run-2.json",
          format: "json",
          fitBasename: "run-2",
          reason: "partial_artifact",
          missingFields: ["rpe"],
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("formatResult", () => {
  // ─── DEFAULT_PROFILE ──────────────────────────────────────────────────────

  describe("DEFAULT_PROFILE", () => {
    it("includes all sections in canonical order", () => {
      expect(DEFAULT_PROFILE.sections).toEqual([
        "summary",
        "elevation_profile",
        "weather",
        "segments",
        "km_splits",
        "zones",
        "dynamics",
        "anomalies",
        "prescription_comparison",
        "metadata",
      ]);
    });

    it("includes all columns", () => {
      expect(DEFAULT_PROFILE.columns).toBe("all");
    });

    it("skips segments for single lap by default", () => {
      expect(DEFAULT_PROFILE.skipSegmentsIfSingleLap).toBe(true);
    });
  });

  // ─── MARKDOWN ─────────────────────────────────────────────────────────────

  describe("markdown format", () => {
    it("## Run Summary appears before ## Metadata (metadata is last)", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      const summaryIdx = output.indexOf("## Run Summary");
      const metaIdx = output.indexOf("## Metadata");
      expect(summaryIdx).toBeGreaterThanOrEqual(0);
      expect(metaIdx).toBeGreaterThan(summaryIdx);
      // Summary must be the very first content
      expect(output.trimStart().startsWith("## Run Summary")).toBe(true);
    });

    it("metadata renders version, downsample=none, anomalies=included", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).toContain("run2max v2.1.0");
      expect(output).toContain("none");
      expect(output).toContain("included");
    });

    it("metadata renders downsample as Ns when set", () => {
      const result = buildResult({
        metadata: { version: "2.1.0", downsample: 5, anomaliesExcluded: true, fileSampleRate: null },
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      expect(output).toContain("5s");
      expect(output).toContain("excluded");
    });

    it("metadata renders File sample rate when fileSampleRate is set", () => {
      const result = buildResult({
        metadata: { version: "2.1.0", downsample: null, anomaliesExcluded: false, fileSampleRate: 1 },
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      expect(output).toContain("File sample rate: 1s");
    });

    it("null avgPower renders as -- in segment table", () => {
      const result = buildResult();
      result.segments[0]!.avgPower = null;
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      // Should contain at least one -- in the table rows
      expect(output).toContain("--");
    });

    it("zone rows with 0% are omitted from Zone Distribution", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).not.toContain("I (Interval)");
      expect(output).toContain("E (Easy)");
      expect(output).toContain("M (Marathon)");
    });

    it("excluded anomaly shows [EXCLUDED FROM STATS] prefix", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).toContain("[EXCLUDED FROM STATS]");
      expect(output).toContain("legSpringStiffness=0");
    });

    it("non-excluded anomaly has no [EXCLUDED FROM STATS] prefix", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      // The heartRate anomaly should appear without the prefix
      const lines = output.split("\n");
      const hrLine = lines.find(l => l.includes("heartRate=0"));
      expect(hrLine).toBeDefined();
      expect(hrLine).not.toContain("[EXCLUDED FROM STATS]");
    });

    it("shows HR % LTHR when avgHeartRatePctLthr is non-null", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).toContain("% LTHR");
    });

    it("omits HR % LTHR when avgHeartRatePctLthr is null", () => {
      const result = buildResult();
      result.summary.avgHeartRatePctLthr = null;
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      expect(output).not.toContain("% LTHR");
    });

    it("renders max values line when maxPower/maxHeartRate are present", () => {
      const result = buildResult();
      result.summary.maxPower = 280;
      result.summary.maxHeartRate = 165;
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("Max Power: 280 W");
      expect(output).toContain("Max HR: 165 bpm");
    });

    it("omits max values line when all max fields are null", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).not.toContain("Max Power:");
      expect(output).not.toContain("Max HR:");
    });

    it("renders elevation line in Run Summary when totalAscent is present", () => {
      const result = buildResult();
      result.summary.totalAscent = 150;
      result.summary.totalDescent = 120;
      result.summary.netElevation = 30;
      result.summary.minAltitude = 225;
      result.summary.maxAltitude = 375;
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("Gain: 150 m");
      expect(output).toContain("Loss: 120 m");
      expect(output).toContain("+30 m");
    });

    it("omits elevation line in Run Summary when elevation data is null", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).not.toContain("Gain:");
    });

    it("renders NP/IF/RSS line when normalizedPower and intensityFactor are present", () => {
      const result = buildResult();
      result.summary.normalizedPower = 241;
      result.summary.intensityFactor = 0.82;
      result.summary.runStressScore = 67.3;
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("NP: 241 W");
      expect(output).toContain("IF: 0.82");
      expect(output).toContain("RSS (r2m): 67.3");
    });

    it("renders avgHrZone and avgPaceZone labels when present", () => {
      const result = buildResult();
      result.summary.avgHrZone = "Z2";
      result.summary.avgPaceZone = "Base";
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("Avg HR Zone: Z2");
      expect(output).toContain("Avg Pace Zone: Base");
    });

    it("omits context lines (Workout/Block/RPE/Notes) when not present", () => {
      const result = buildResult();
      delete result.summary.workout;
      delete result.summary.block;
      delete result.summary.rpe;
      delete result.summary.notes;
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      expect(output).not.toContain("Workout:");
      expect(output).not.toContain("Notes:");
    });

    it("pipe table rows have consistent column counts", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      // Find all pipe-table lines in the segments section
      const lines = output.split("\n").filter(l => l.startsWith("|"));
      // Group into contiguous blocks
      let blockStart = 0;
      while (blockStart < lines.length) {
        // Count columns in first line of block
        const expectedCols = lines[blockStart]!.split("|").length;
        let blockEnd = blockStart + 1;
        while (blockEnd < lines.length && lines[blockEnd]!.split("|").length === expectedCols) {
          blockEnd++;
        }
        // All lines in this block should have the same column count
        const block = lines.slice(blockStart, blockEnd);
        const counts = block.map(l => l.split("|").length);
        expect(new Set(counts).size).toBe(1);
        blockStart = blockEnd;
      }
    });

    it("renders zone in parentheses after power in Run Summary", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).toContain("224 W (E)");
    });

    it("renders available prescription comparison section with run and step evidence", () => {
      const result = buildResult({ prescriptionComparison: buildAvailableComparison() });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("## Prescription Comparison");
      expect(output).toContain("Prescribed Run: 4x5min (2026-04-12)");
      expect(output).toContain("Match Kind: date");
      expect(output).toContain("Comparison Group: threshold_5min");
      expect(output).toContain("Actual Run:");
      expect(output).toContain("5min@SUB-T");
      expect(output).toContain("within_tolerance");
      expect(output).toContain("within");
    });

    it("renders unavailable prescription comparison without a fabricated step table", () => {
      const result = buildResult({ prescriptionComparison: buildUnavailableComparison() });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("## Prescription Comparison");
      expect(output).toContain("Status: unavailable (step_count_mismatch)");
      expect(output).toContain("Counts: Prescribed Steps 8 | Actual Segments 7");
      expect(output).not.toContain("| Prescribed Step | Source | Target Kind");
    });

    it("renders comparable history subsection for available prescription comparison", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryAvailableComparison(),
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("Comparable History");
      expect(output).toContain("2026-04-05");
      expect(output).toContain("/tmp/block/run-1.json");
    });

    it("renders comparable history metric values with units and signed deltas", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryAvailableComparison(),
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("| Avg Power");
      expect(output).toContain("+24 W");
      expect(output).toContain("| Avg HR");
      expect(output).toContain("+8 bpm");
      expect(output).toContain("| Max HR");
      expect(output).toContain("+5 bpm");
      expect(output).toContain("| Avg Pace");
      expect(output).toContain("-0:11/km");
      expect(output).toContain("| RPE");
      expect(output).toContain("|       -1 |");
    });

    it("renders unavailable comparable-history metrics inline with explicit reasons", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryWithMissingPriorRpeComparison(),
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("missing_prior_value");
      expect(output).toContain("unavailable (missing_prior_value)");
      expect(output).not.toContain("| RPE       |       2 |       0 |");
    });

    it("renders unavailable comparable history with top-level and candidate reasons", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryUnavailableComparison(),
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("Comparable History");
      expect(output).toContain("all_candidates_unavailable");
      expect(output).toContain("ambiguous_artifact");
      expect(output).toContain("partial_artifact: rpe");
    });

    it("does not render comparable history when available comparison has no comparableHistory", () => {
      const result = buildResult({ prescriptionComparison: buildAvailableComparison() });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);

      expect(output).toContain("## Prescription Comparison");
      expect(output).not.toContain("Comparable History");
    });
  });

  // ─── PROFILE FILTERING: SECTIONS ──────────────────────────────────────────

  describe("profile filtering — sections", () => {
    it("only renders summary when sections=['summary']", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).toContain("## Run Summary");
      expect(output).not.toContain("## Workout Splits");
      expect(output).not.toContain("## Zone Distribution");
      expect(output).not.toContain("## Running Dynamics");
      expect(output).not.toContain("## Anomalies");
    });

    it("does not include ## Metadata when not in sections", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).not.toContain("## Metadata");
    });

    it("hides prescription comparison when section is excluded", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const result = buildResult({ prescriptionComparison: buildAvailableComparison() });

      const markdown = formatResult(result, "markdown", profile).output;
      const json = JSON.parse(formatResult(result, "json", profile).output) as Record<string, unknown>;
      const yaml = parseYaml(formatResult(result, "yaml", profile).output) as Record<string, unknown>;

      expect(markdown).not.toContain("## Prescription Comparison");
      expect(json["prescriptionComparison"]).toBeUndefined();
      expect(yaml["prescription_comparison"]).toBeUndefined();
    });

    it("omits comparable history in all formats when prescription_comparison is excluded", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryAvailableComparison(),
      });

      const markdown = formatResult(result, "markdown", profile).output;
      const json = JSON.parse(formatResult(result, "json", profile).output) as Record<string, unknown>;
      const yaml = parseYaml(formatResult(result, "yaml", profile).output) as Record<string, unknown>;

      expect(markdown).not.toContain("Comparable History");
      expect(json["prescriptionComparison"]).toBeUndefined();
      expect(yaml["prescription_comparison"]).toBeUndefined();
    });

    it("includes ## Metadata when metadata is in sections", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["metadata"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).toContain("## Metadata");
    });

    it("renders ## Elevation Profile with stats and chart when elevationProfile is present", () => {
      const result = buildResult({
        elevationProfile: {
          totalAscent: 150,
          totalDescent: 120,
          netElevation: 30,
          minAltitude: 225,
          maxAltitude: 375,
          points: [[0, 225], [5, 375], [10, 255]],
        },
      });
      const profile = { ...DEFAULT_PROFILE, sections: ["elevation_profile"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("## Elevation Profile");
      expect(output).toContain("Gain: 150 m");
      expect(output).toContain("Loss: 120 m");
      expect(output).toContain("+30 m");
      expect(output).toContain("```");
    });

    it("omits ## Elevation Profile when elevationProfile is null", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["elevation_profile"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).not.toContain("## Elevation Profile");
    });

    it("renders ## Weather with temp, humidity, wind, conditions when weatherSummary is present", () => {
      const result = buildResult({
        weatherSummary: {
          temperature: 18,
          humidity: 62,
          dewPoint: 10,
          windSpeed: 12,
          windDirection: 315,
          conditions: "Partly cloudy",
        },
      });
      const profile = { ...DEFAULT_PROFILE, sections: ["weather"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("## Weather");
      expect(output).toContain("18 C");
      expect(output).toContain("62 %");
      expect(output).toContain("12 km/h NW");
      expect(output).toContain("Partly cloudy");
    });

    it("omits ## Weather when weatherSummary is null", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["weather"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).not.toContain("## Weather");
    });

    it("renders ## HR Zone Distribution when hrZoneDistribution is non-empty", () => {
      const result = buildResult({
        hrZoneDistribution: [
          { label: "Z1", name: "Recovery", seconds: 300, percentage: 10 },
          { label: "Z2", name: "Base", seconds: 2700, percentage: 90 },
        ],
      });
      const profile = { ...DEFAULT_PROFILE, sections: ["hr_zones"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("## HR Zone Distribution");
      expect(output).toContain("Z2 (Base)");
    });

    it("omits ## HR Zone Distribution when hrZoneDistribution is empty", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["hr_zones"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).not.toContain("## HR Zone Distribution");
    });

    it("renders ## Pace Zone Distribution when paceZoneDistribution is non-empty", () => {
      const result = buildResult({
        paceZoneDistribution: [
          { label: "Z1", name: "Easy", seconds: 3000, percentage: 80 },
          { label: "Z2", name: "Moderate", seconds: 750, percentage: 20 },
        ],
      });
      const profile = { ...DEFAULT_PROFILE, sections: ["pace_zones"] as SectionId[] };
      const { output } = formatResult(result, "markdown", profile);
      expect(output).toContain("## Pace Zone Distribution");
      expect(output).toContain("Z1 (Easy)");
    });
  });

  // ─── PROFILE FILTERING: COLUMNS ───────────────────────────────────────────

  describe("profile filtering — columns", () => {
    it("only renders requested columns in Workout Splits table", () => {
      const profile = {
        ...DEFAULT_PROFILE,
        columns: ["power", "pace"] as ColumnId[],
      };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).toContain("Power");
      expect(output).toContain("Pace");
      // HR and Cadence should not appear as table headers
      const tableSection = output.slice(
        output.indexOf("## Workout Splits"),
        output.indexOf("\n## ", output.indexOf("## Workout Splits") + 1)
      );
      expect(tableSection).not.toContain("| HR");
      expect(tableSection).not.toContain("| Cadence");
    });
  });

  // ─── COLUMN RECONCILIATION ────────────────────────────────────────────────

  describe("column reconciliation", () => {
    it("drops tier-2 columns and warns when hasRunningDynamics=false", () => {
      const result = buildResult({
        capabilities: { hasRunningDynamics: false, hasStrydEnhanced: false },
      });
      const { warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
      // Should warn about at least one tier-2 column (e.g. gct)
      const warnText = warnings.join(" ").toLowerCase();
      expect(warnText).toMatch(/gct|stride|vo/);
    });

    it("drops fpr column and warns when hasStrydEnhanced=false", () => {
      const result = buildResult({
        capabilities: { hasRunningDynamics: true, hasStrydEnhanced: false },
      });
      const { warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
      const warnText = warnings.join(" ").toLowerCase();
      expect(warnText).toContain("fpr");
    });

    it("drops zone column and warns when no zone distribution data", () => {
      const result = buildResult({ zoneDistribution: [] });
      const { warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
      const warnText = warnings.join(" ").toLowerCase();
      expect(warnText).toContain("zone");
    });

    it("drops elev_gain and elev_loss when no elevation data available", () => {
      const result = buildResult({ elevationProfile: null });
      const { warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
      const warnText = warnings.join(" ");
      expect(warnText).toContain("elev_gain");
      expect(warnText).toContain("elev_loss");
    });

    it("keeps elev_gain and elev_loss when elevation data is available", () => {
      const result = buildResult({
        elevationProfile: {
          totalAscent: 100, totalDescent: 80, netElevation: 20,
          minAltitude: 200, maxAltitude: 300, points: [[0, 200], [5, 300], [10, 220]],
        },
      });
      const { warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
      const warnText = warnings.join(" ");
      expect(warnText).not.toContain("elev_gain");
      expect(warnText).not.toContain("elev_loss");
    });

    it("drops wind and temp columns when no weather data available", () => {
      const result = buildResult({ weatherSummary: null });
      const { warnings } = formatResult(result, "markdown", DEFAULT_PROFILE);
      const warnText = warnings.join(" ");
      expect(warnText).toContain('"wind"');
      expect(warnText).toContain('"temp"');
    });
  });

  // ─── SKIP SEGMENTS IF SINGLE LAP ──────────────────────────────────────────

  describe("skipSegmentsIfSingleLap", () => {
    it("omits Workout Splits when 1 segment and flag is true, adds warning", () => {
      const profile = { ...DEFAULT_PROFILE, skipSegmentsIfSingleLap: true };
      const result = buildResult({ segments: [buildResult().segments[0]!] });
      const { output, warnings } = formatResult(result, "markdown", profile);
      expect(output).not.toContain("## Workout Splits");
      expect(warnings.some(w => w.toLowerCase().includes("segment"))).toBe(true);
    });

    it("keeps Workout Splits when 2 segments and default profile (skipSegmentsIfSingleLap=true)", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).toContain("## Workout Splits");
    });

    it("does not hide prescription comparison when segments are skipped", () => {
      const profile = { ...DEFAULT_PROFILE, skipSegmentsIfSingleLap: true };
      const result = buildResult({
        segments: [buildResult().segments[0]!],
        prescriptionComparison: buildAvailableComparison(),
      });
      const { output } = formatResult(result, "markdown", profile);

      expect(output).not.toContain("## Workout Splits");
      expect(output).toContain("## Prescription Comparison");
    });
  });

  // ─── JSON FORMAT ──────────────────────────────────────────────────────────

  describe("json format", () => {
    it("includes prescriptionComparison in default JSON output when comparison data exists", () => {
      const result = buildResult({
        prescriptionComparison: buildAvailableComparison(),
      });

      const { output } = formatResult(result, "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;

      expect(parsed["prescriptionComparison"]).toBeDefined();
    });

    it("preserves available prescription comparison shape", () => {
      const result = buildResult({ prescriptionComparison: buildAvailableComparison() });
      const { output } = formatResult(result, "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const comparison = parsed["prescriptionComparison"] as Record<string, unknown>;
      const actual = comparison["actual"] as Record<string, unknown>;
      const steps = comparison["steps"] as Array<Record<string, unknown>>;

      expect(comparison["status"]).toBe("available");
      expect(comparison["prescribedRun"]).toBeDefined();
      expect(actual["avgPower"]).toBe(224);
      expect(steps).toHaveLength(1);
    });

    it("preserves unavailable prescription comparison shape", () => {
      const result = buildResult({ prescriptionComparison: buildUnavailableComparison() });
      const { output } = formatResult(result, "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const comparison = parsed["prescriptionComparison"] as Record<string, unknown>;

      expect(comparison["status"]).toBe("unavailable");
      expect(comparison["reason"]).toBe("step_count_mismatch");
      expect(comparison["prescribedStepCount"]).toBe(8);
      expect(comparison["actualSegmentCount"]).toBe(7);
    });

    it("preserves available comparableHistory shape under prescriptionComparison", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryAvailableComparison(),
      });
      const { output } = formatResult(result, "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const comparison = parsed["prescriptionComparison"] as Record<string, unknown>;
      const comparableHistory = comparison["comparableHistory"] as Record<string, unknown>;
      const runs = comparableHistory["runs"] as Array<Record<string, unknown>>;

      expect(comparableHistory["status"]).toBe("available");
      expect(runs[0]!["sourcePath"]).toBe("/tmp/block/run-1.json");
      expect(runs[0]!["capturedDate"]).toBe("2026-04-05");
    });

    it("preserves unavailable comparableHistory shape under prescriptionComparison", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryUnavailableComparison(),
      });
      const { output } = formatResult(result, "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const comparison = parsed["prescriptionComparison"] as Record<string, unknown>;
      const comparableHistory = comparison["comparableHistory"] as Record<string, unknown>;
      const candidates = comparableHistory["candidates"] as Array<Record<string, unknown>>;

      expect(comparableHistory["status"]).toBe("unavailable");
      expect(comparableHistory["reason"]).toBe("all_candidates_unavailable");
      expect(candidates[0]!["reason"]).toBe("ambiguous_artifact");
      expect(candidates[1]!["reason"]).toBe("partial_artifact");
    });

    it("produces valid JSON", () => {
      const { output } = formatResult(buildResult(), "json", DEFAULT_PROFILE);
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("metadata key is always present with correct values", () => {
      const { output } = formatResult(buildResult(), "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed["metadata"]).toBeDefined();
      const meta = parsed["metadata"] as Record<string, unknown>;
      expect(meta["version"]).toBe("2.1.0");
      expect(meta["downsample"]).toBeNull();
      expect(meta["anomaliesExcluded"]).toBe(false);
    });

    it("omitted sections have no key in JSON output", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "json", profile);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed["summary"]).toBeDefined();
      expect(parsed["segments"]).toBeUndefined();
      expect(parsed["zoneDistribution"]).toBeUndefined();
    });

    it("null row values serialize as null", () => {
      const result = buildResult();
      result.segments[0]!.avgPower = null;
      const { output } = formatResult(result, "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const segs = parsed["segments"] as Array<Record<string, unknown>>;
      expect(segs[0]!["avgPower"]).toBeNull();
    });

    it("column-filtered rows include identity fields plus requested columns only", () => {
      const profile = {
        ...DEFAULT_PROFILE,
        columns: ["power"] as ColumnId[],
      };
      const { output } = formatResult(buildResult(), "json", profile);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      const segs = parsed["segments"] as Array<Record<string, unknown>>;
      const seg = segs[0]!;
      // Identity fields always present
      expect(seg["lapIndex"]).toBeDefined();
      expect(seg["distance"]).toBeDefined();
      expect(seg["duration"]).toBeDefined();
      // Requested column present
      expect(seg["avgPower"]).toBeDefined();
      // Other columns absent
      expect(seg["avgHeartRate"]).toBeUndefined();
      expect(seg["avgCadence"]).toBeUndefined();
    });
  });

  // ─── YAML FORMAT ──────────────────────────────────────────────────────────

  describe("yaml format", () => {
    it("produces valid YAML", () => {
      const { output } = formatResult(buildResult(), "yaml", DEFAULT_PROFILE);
      expect(() => parseYaml(output)).not.toThrow();
    });

    it("metadata key is always present", () => {
      const { output } = formatResult(buildResult(), "yaml", DEFAULT_PROFILE);
      const parsed = parseYaml(output) as Record<string, unknown>;
      expect(parsed["metadata"]).toBeDefined();
    });

    it("uses snake_case for camelCase keys", () => {
      const { output } = formatResult(buildResult(), "yaml", DEFAULT_PROFILE);
      const parsed = parseYaml(output) as Record<string, unknown>;
      // avgPower → avg_power in segment rows
      const segs = parsed["segments"] as Array<Record<string, unknown>>;
      expect(segs[0]).toHaveProperty("avg_power");
      expect(segs[0]).not.toHaveProperty("avgPower");
      // zoneDistribution → zone_distribution at top level
      expect(parsed).toHaveProperty("zone_distribution");
      expect(parsed).not.toHaveProperty("zoneDistribution");
    });

    it("omitted sections have no key in YAML output", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "yaml", profile);
      const parsed = parseYaml(output) as Record<string, unknown>;
      expect(parsed["summary"]).toBeDefined();
      expect(parsed["segments"]).toBeUndefined();
    });

    it("includes snake_case prescription_comparison for available shape", () => {
      const result = buildResult({ prescriptionComparison: buildAvailableComparison() });
      const { output } = formatResult(result, "yaml", DEFAULT_PROFILE);
      const parsed = parseYaml(output) as Record<string, unknown>;
      const comparison = parsed["prescription_comparison"] as Record<string, unknown>;

      expect(comparison["status"]).toBe("available");
      expect(comparison["prescribed_run"]).toBeDefined();
      expect(comparison["actual"]).toBeDefined();
      expect(comparison["steps"]).toBeDefined();
    });

    it("includes snake_case unavailable fields in prescription_comparison", () => {
      const result = buildResult({ prescriptionComparison: buildUnavailableComparison() });
      const { output } = formatResult(result, "yaml", DEFAULT_PROFILE);
      const parsed = parseYaml(output) as Record<string, unknown>;
      const comparison = parsed["prescription_comparison"] as Record<string, unknown>;

      expect(comparison["status"]).toBe("unavailable");
      expect(comparison["reason"]).toBe("step_count_mismatch");
      expect(comparison["prescribed_step_count"]).toBe(8);
      expect(comparison["actual_segment_count"]).toBe(7);
    });

    it("includes snake_case comparable_history fields in YAML output", () => {
      const result = buildResult({
        prescriptionComparison: buildComparableHistoryWithMissingPriorRpeComparison(),
      });
      const { output } = formatResult(result, "yaml", DEFAULT_PROFILE);
      const parsed = parseYaml(output) as Record<string, unknown>;
      const comparison = parsed["prescription_comparison"] as Record<string, unknown>;
      const comparableHistory = comparison["comparable_history"] as Record<string, unknown>;
      const runs = comparableHistory["runs"] as Array<Record<string, unknown>>;
      const metrics = runs[0]!["metrics"] as Array<Record<string, unknown>>;

      expect(comparableHistory["status"]).toBe("available");
      expect(runs[0]!["source_path"]).toBe("/tmp/block/run-1.json");
      expect(runs[0]!["captured_date"]).toBe("2026-04-05");
      expect(metrics[4]!["reason"]).toBe("missing_prior_value");
    });

    it("omits prescription comparison when result has no comparison data", () => {
      const { output: jsonOutput } = formatResult(buildResult(), "json", DEFAULT_PROFILE);
      const { output: yamlOutput } = formatResult(buildResult(), "yaml", DEFAULT_PROFILE);

      const parsedJson = JSON.parse(jsonOutput) as Record<string, unknown>;
      const parsedYaml = parseYaml(yamlOutput) as Record<string, unknown>;

      expect(parsedJson["prescriptionComparison"]).toBeUndefined();
      expect(parsedYaml["prescription_comparison"]).toBeUndefined();
    });
  });

  describe("prescription comparison isolation", () => {
    it("does not depend on active split columns", () => {
      const result = buildResult({ prescriptionComparison: buildAvailableComparison() });
      const profile = {
        ...DEFAULT_PROFILE,
        columns: ["power"] as ColumnId[],
      };
      const { output } = formatResult(result, "markdown", profile);

      expect(output).toContain("## Prescription Comparison");
      expect(output).toContain("Completion");
      expect(output).toContain("Power");
      expect(output).toContain("within_tolerance");
      expect(output).toContain("within");
    });
  });
});
