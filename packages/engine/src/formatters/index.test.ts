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
      version: "0.0.1",
      downsample: null,
      anomaliesExcluded: false,
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
      },
    ],
    zoneDistribution: [
      { label: "E", name: "Easy",     seconds: 7106, percentage: 96.0 },
      { label: "M", name: "Marathon", seconds: 148,  percentage: 2.0  },
      { label: "I", name: "Interval", seconds: 0,    percentage: 0.0  }, // must be omitted
    ],
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
        "segments",
        "km_splits",
        "zones",
        "dynamics",
        "anomalies",
      ]);
    });

    it("includes all columns", () => {
      expect(DEFAULT_PROFILE.columns).toBe("all");
    });

    it("does not skip segments for single lap", () => {
      expect(DEFAULT_PROFILE.skipSegmentsIfSingleLap).toBe(false);
    });
  });

  // ─── MARKDOWN ─────────────────────────────────────────────────────────────

  describe("markdown format", () => {
    it("## Metadata appears first, before ## Run Summary", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      const metaIdx = output.indexOf("## Metadata");
      const summaryIdx = output.indexOf("## Run Summary");
      expect(metaIdx).toBeGreaterThanOrEqual(0);
      expect(summaryIdx).toBeGreaterThan(metaIdx);
      // Must be the very first content
      expect(output.trimStart().startsWith("## Metadata")).toBe(true);
    });

    it("metadata renders version, downsample=none, anomalies=included", () => {
      const { output } = formatResult(buildResult(), "markdown", DEFAULT_PROFILE);
      expect(output).toContain("run2max v0.0.1");
      expect(output).toContain("none");
      expect(output).toContain("included");
    });

    it("metadata renders downsample as Ns when set", () => {
      const result = buildResult({
        metadata: { version: "0.0.1", downsample: 5, anomaliesExcluded: true },
      });
      const { output } = formatResult(result, "markdown", DEFAULT_PROFILE);
      expect(output).toContain("5s");
      expect(output).toContain("excluded");
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

    it("always includes ## Metadata even when not in sections", () => {
      const profile = { ...DEFAULT_PROFILE, sections: ["summary"] as SectionId[] };
      const { output } = formatResult(buildResult(), "markdown", profile);
      expect(output).toContain("## Metadata");
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

    it("keeps Workout Splits when 2 segments and flag is true", () => {
      const profile = { ...DEFAULT_PROFILE, skipSegmentsIfSingleLap: true };
      const { output } = formatResult(buildResult(), "markdown", profile);
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
      expect(meta["version"]).toBe("0.0.1");
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
