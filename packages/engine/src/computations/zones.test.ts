import { describe, it, expect } from "vitest";
import { classifyPowerZone, computeZoneDistribution } from "./zones.js";
import type { Run2MaxRecord, ZoneConfig } from "../types.js";

const ZONES: ZoneConfig[] = [
  { label: "E", name: "Easy", min: 204, max: 233 },
  { label: "M", name: "Marathon", min: 251, max: 260 },
  { label: "SS", name: "Sweet Spot", min: 260, max: 269 },
  { label: "HM", name: "Half Marathon", min: 269, max: 280 },
  { label: "SUB-T", name: "Sub-Threshold", min: 280, max: 289 },
  { label: "THRESH", name: "Threshold", min: 289, max: 301 },
];

function rec(power: number | undefined): Run2MaxRecord {
  return { timestamp: new Date(), power } as Run2MaxRecord;
}

describe("classifyPowerZone", () => {
  it("returns zone label when power is within bounds", () => {
    expect(classifyPowerZone(220, ZONES)).toBe("E");
    expect(classifyPowerZone(255, ZONES)).toBe("M");
    expect(classifyPowerZone(295, ZONES)).toBe("THRESH");
  });

  it("returns zone label at exact boundaries", () => {
    expect(classifyPowerZone(204, ZONES)).toBe("E");
    expect(classifyPowerZone(233, ZONES)).toBe("E");
    expect(classifyPowerZone(301, ZONES)).toBe("THRESH");
  });

  it("returns 'below <label>' when power is below all zones", () => {
    expect(classifyPowerZone(100, ZONES)).toBe("below E");
    expect(classifyPowerZone(203, ZONES)).toBe("below E");
  });

  it("returns 'above <label>' when power is above all zones", () => {
    expect(classifyPowerZone(302, ZONES)).toBe("above THRESH");
    expect(classifyPowerZone(500, ZONES)).toBe("above THRESH");
  });

  it("returns '<lower>→<upper>' for gap between zones", () => {
    expect(classifyPowerZone(240, ZONES)).toBe("E\u2192M");
    expect(classifyPowerZone(234, ZONES)).toBe("E\u2192M");
    expect(classifyPowerZone(250, ZONES)).toBe("E\u2192M");
  });

  it("handles unsorted zones input", () => {
    const reversed = [...ZONES].reverse();
    expect(classifyPowerZone(220, reversed)).toBe("E");
    expect(classifyPowerZone(240, reversed)).toBe("E\u2192M");
  });
});

describe("computeZoneDistribution", () => {
  it("all configured zones appear even with 0 time", () => {
    const records = [rec(220), rec(220)]; // all in E
    const result = computeZoneDistribution(records, ZONES, 1);

    expect(result.length).toBeGreaterThanOrEqual(ZONES.length);
    for (const zone of ZONES) {
      expect(result.find((r) => r.label === zone.label)).toBeDefined();
    }
  });

  it("computes correct percentages", () => {
    const records = [rec(220), rec(220), rec(220), rec(255)]; // 3 E, 1 M
    const result = computeZoneDistribution(records, ZONES, 1);

    const eZone = result.find((r) => r.label === "E")!;
    const mZone = result.find((r) => r.label === "M")!;
    expect(eZone.seconds).toBe(3);
    expect(eZone.percentage).toBe(75);
    expect(mZone.seconds).toBe(1);
    expect(mZone.percentage).toBe(25);
  });

  it("percentages sum to 100", () => {
    const records = [rec(220), rec(255), rec(265), rec(295)];
    const result = computeZoneDistribution(records, ZONES, 1);
    const total = result.reduce((sum, r) => sum + r.percentage, 0);
    expect(total).toBeCloseTo(100);
  });

  it("gap/out-of-range rows only appear if time > 0", () => {
    const records = [rec(220)]; // only E, no gaps hit
    const result = computeZoneDistribution(records, ZONES, 1);
    const extraRows = result.filter(
      (r) => !ZONES.some((z) => z.label === r.label),
    );
    expect(extraRows).toHaveLength(0);
  });

  it("includes gap row when power falls in gap", () => {
    const records = [rec(240)]; // E→M gap
    const result = computeZoneDistribution(records, ZONES, 1);
    const gapRow = result.find((r) => r.label === "E\u2192M");
    expect(gapRow).toBeDefined();
    expect(gapRow!.seconds).toBe(1);
  });

  it("includes below/above rows when power is out of range", () => {
    const records = [rec(100), rec(500)];
    const result = computeZoneDistribution(records, ZONES, 1);
    expect(result.find((r) => r.label === "below E")).toBeDefined();
    expect(result.find((r) => r.label === "above THRESH")).toBeDefined();
  });

  it("respects intervalSeconds for downsampled data", () => {
    const records = [rec(220), rec(220)]; // 2 records at 10s interval
    const result = computeZoneDistribution(records, ZONES, 10);
    const eZone = result.find((r) => r.label === "E")!;
    expect(eZone.seconds).toBe(20);
  });

  it("skips records with null power", () => {
    const records = [rec(220), rec(undefined)];
    const result = computeZoneDistribution(records, ZONES, 1);
    const total = result.reduce((sum, r) => sum + r.seconds, 0);
    expect(total).toBe(1);
  });
});
