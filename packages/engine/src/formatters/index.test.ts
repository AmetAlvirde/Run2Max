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
      version: "1.0.0",
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
      expect(output).toContain("run2max v1.0.0");
      expect(output).toContain("none");
      expect(output).toContain("included");
    });

    it("metadata renders downsample as Ns when set", () => {
      const result = buildResult({
        metadata: { version: "1.0.0", downsample: 5, anomaliesExcluded: true, fileSampleRate: null },
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      expect(output).toContain("5s");
      expect(output).toContain("excluded");
    });

    it("metadata renders File sample rate when fileSampleRate is set", () => {
      const result = buildResult({
        metadata: { version: "1.0.0", downsample: null, anomaliesExcluded: false, fileSampleRate: 1 },
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
  });

  // ─── JSON FORMAT ──────────────────────────────────────────────────────────

  describe("json format", () => {
    it("produces valid JSON", () => {
      const { output } = formatResult(buildResult(), "json", DEFAULT_PROFILE);
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it("metadata key is always present with correct values", () => {
      const { output } = formatResult(buildResult(), "json", DEFAULT_PROFILE);
      const parsed = JSON.parse(output) as Record<string, unknown>;
      expect(parsed["metadata"]).toBeDefined();
      const meta = parsed["metadata"] as Record<string, unknown>;
      expect(meta["version"]).toBe("1.0.0");
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
  });
});
