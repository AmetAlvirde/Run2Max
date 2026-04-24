import { describe, it, expect } from "vitest";
import { parseConfig } from "./schema.js";

const minimalConfig = {
  power_zones: [{ label: "E", name: "Easy", min: 204, max: 233 }],
};

const fullConfig = {
  calibration: {
    date: "2026-02-01",
    source: "RECON block",
    critical_power: 295,
    lthr: 171,
  },
  power_zones: [
    { label: "E", name: "Easy", min: 204, max: 233, rpe: "2-4" },
    { label: "M", name: "Marathon", min: 251, max: 260, rpe: "5-6" },
    { label: "THRESH", name: "Threshold", min: 289, max: 301, rpe: "7-8" },
  ],
  thresholds: { lthr: 171, max_hr: 192 },
  athlete: { timezone: "America/Santiago" },
  output: {
    default: {
      sections: ["summary", "km_splits", "zones"],
      columns: ["power", "zone", "pace"],
      skip_segments_if_single_lap: true,
    },
    detailed: {
      sections: ["summary", "segments", "km_splits", "zones"],
      columns: "all",
      skip_segments_if_single_lap: false,
    },
  },
};

describe("parseConfig", () => {
  it("accepts a minimal config with only powerZones", () => {
    const result = parseConfig(minimalConfig);
    expect(result.powerZones).toHaveLength(1);
    expect(result.powerZones[0]).toEqual({ label: "E", name: "Easy", min: 204, max: 233 });
  });

  it("transforms snake_case keys to camelCase", () => {
    const result = parseConfig(fullConfig);
    expect(result.calibration?.criticalPower).toBe(295);
    expect(result.thresholds?.maxHr).toBe(192);
    expect(result.output?.default?.skipSegmentsIfSingleLap).toBe(true);
  });

  it("accepts a full config with all optional fields", () => {
    const result = parseConfig(fullConfig);
    expect(result.calibration?.date).toBe("2026-02-01");
    expect(result.calibration?.source).toBe("RECON block");
    expect(result.calibration?.lthr).toBe(171);
    expect(result.powerZones).toHaveLength(3);
    expect(result.athlete?.timezone).toBe("America/Santiago");
    expect(result.output?.detailed?.columns).toBe("all");
    expect(result.output?.default?.columns).toEqual(["power", "zone", "pace"]);
  });

  it("throws when powerZones is missing", () => {
    expect(() => parseConfig({ calibration: { critical_power: 295 } })).toThrow();
  });

  it("throws when powerZones is an empty array", () => {
    expect(() => parseConfig({ power_zones: [] })).toThrow(/at least one/);
  });

  it("throws when a zone is missing required fields", () => {
    expect(() =>
      parseConfig({ power_zones: [{ label: "E", min: 204 }] })
    ).toThrow();
  });

  it("throws when a zone field has the wrong type", () => {
    expect(() =>
      parseConfig({ power_zones: [{ label: "E", name: "Easy", min: "204", max: 233 }] })
    ).toThrow();
  });

  it("strips unknown top-level keys", () => {
    const result = parseConfig({ ...minimalConfig, unknownField: "ignored" });
    expect((result as Record<string, unknown>).unknownField).toBeUndefined();
  });

  // ── New optional fields ───────────────────────────────────────────────────

  it("accepts hrZones when provided", () => {
    const result = parseConfig({
      ...minimalConfig,
      hr_zones: [{ label: "Z1", name: "Recovery", min: 100, max: 130 }],
    });
    expect(result.hrZones).toHaveLength(1);
    expect(result.hrZones![0]!.label).toBe("Z1");
  });

  it("throws when hrZones is an empty array", () => {
    expect(() => parseConfig({ ...minimalConfig, hr_zones: [] })).toThrow(/at least one/);
  });

  it("accepts paceZones when provided", () => {
    const result = parseConfig({
      ...minimalConfig,
      pace_zones: [{ label: "E", name: "Easy", min: 360, max: 480 }],
    });
    expect(result.paceZones).toHaveLength(1);
    expect(result.paceZones![0]!.label).toBe("E");
  });

  it("throws when paceZones is an empty array", () => {
    expect(() => parseConfig({ ...minimalConfig, pace_zones: [] })).toThrow(/at least one/);
  });

  it("accepts weather: true", () => {
    const result = parseConfig({ ...minimalConfig, weather: true });
    expect(result.weather).toBe(true);
  });

  it("accepts weather: false", () => {
    const result = parseConfig({ ...minimalConfig, weather: false });
    expect(result.weather).toBe(false);
  });

  it("accepts units: metric", () => {
    const result = parseConfig({ ...minimalConfig, units: "metric" });
    expect(result.units).toBe("metric");
  });

  // ── New section IDs ───────────────────────────────────────────────────────

  it("accepts new section IDs in output profile", () => {
    const result = parseConfig({
      ...minimalConfig,
      output: {
        default: {
          sections: ["summary", "elevation_profile", "weather", "hr_zones", "pace_zones", "metadata"],
        },
      },
    });
    expect(result.output?.default?.sections).toContain("elevation_profile");
    expect(result.output?.default?.sections).toContain("weather");
    expect(result.output?.default?.sections).toContain("hr_zones");
    expect(result.output?.default?.sections).toContain("pace_zones");
    expect(result.output?.default?.sections).toContain("metadata");
  });

  // ── New column IDs ────────────────────────────────────────────────────────

  it("accepts new column IDs in output profile", () => {
    const result = parseConfig({
      ...minimalConfig,
      output: {
        default: {
          columns: ["power", "elev_gain", "elev_loss", "air_power", "wind", "temp"],
        },
      },
    });
    expect(result.output?.default?.columns).toContain("elev_gain");
    expect(result.output?.default?.columns).toContain("elev_loss");
    expect(result.output?.default?.columns).toContain("air_power");
    expect(result.output?.default?.columns).toContain("wind");
    expect(result.output?.default?.columns).toContain("temp");
  });
});
