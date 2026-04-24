import { describe, it, expect } from "vitest";
import { parseConfig } from "./schema.js";

const minimalConfig = {
  zones: [{ label: "E", name: "Easy", min: 204, max: 233 }],
};

const fullConfig = {
  calibration: {
    date: "2026-02-01",
    source: "RECON block",
    critical_power: 295,
    lthr: 171,
  },
  zones: [
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
  it("accepts a minimal config with only zones", () => {
    const result = parseConfig(minimalConfig);
    expect(result.zones).toHaveLength(1);
    expect(result.zones[0]).toEqual({ label: "E", name: "Easy", min: 204, max: 233 });
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
    expect(result.zones).toHaveLength(3);
    expect(result.athlete?.timezone).toBe("America/Santiago");
    expect(result.output?.detailed?.columns).toBe("all");
    expect(result.output?.default?.columns).toEqual(["power", "zone", "pace"]);
  });

  it("throws when zones is missing", () => {
    expect(() => parseConfig({ calibration: { critical_power: 295 } })).toThrow();
  });

  it("throws when zones is an empty array", () => {
    expect(() => parseConfig({ zones: [] })).toThrow(/at least one/);
  });

  it("throws when a zone is missing required fields", () => {
    expect(() =>
      parseConfig({ zones: [{ label: "E", min: 204 }] })
    ).toThrow();
  });

  it("throws when a zone field has the wrong type", () => {
    expect(() =>
      parseConfig({ zones: [{ label: "E", name: "Easy", min: "204", max: 233 }] })
    ).toThrow();
  });

  it("strips unknown top-level keys", () => {
    const result = parseConfig({ ...minimalConfig, unknownField: "ignored" });
    expect((result as Record<string, unknown>).unknownField).toBeUndefined();
  });
});
