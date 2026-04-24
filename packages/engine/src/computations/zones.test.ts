import { describe, it, expect } from "vitest";
import {
  classifyZone,
  classifyPowerZone,
  computeZoneDistribution,
  computePowerZoneDistribution,
  computeHrZoneDistribution,
  computePaceZoneDistribution,
} from "./zones.js";
import type { Run2MaxRecord, ZoneConfig } from "../types.js";

const POWER_ZONES: ZoneConfig[] = [
  { label: "E",      name: "Easy",           min: 204, max: 233 },
  { label: "M",      name: "Marathon",        min: 251, max: 260 },
  { label: "SS",     name: "Sweet Spot",      min: 260, max: 269 },
  { label: "HM",     name: "Half Marathon",   min: 269, max: 280 },
  { label: "SUB-T",  name: "Sub-Threshold",   min: 280, max: 289 },
  { label: "THRESH", name: "Threshold",       min: 289, max: 301 },
];

const HR_ZONES: ZoneConfig[] = [
  { label: "Z1", name: "Recovery",    min: 0,   max: 127 },
  { label: "Z2", name: "Aerobic",     min: 128, max: 152 },
  { label: "Z3", name: "Tempo",       min: 153, max: 166 },
  { label: "Z4", name: "Threshold",   min: 167, max: 179 },
  { label: "Z5", name: "VO2max",      min: 180, max: 999 },
];

// Pace zones in sec/km (lower = faster)
const PACE_ZONES: ZoneConfig[] = [
  { label: "Z1", name: "Recovery",  min: 390, max: 600 }, // 6:30–10:00/km
  { label: "Z2", name: "Aerobic",   min: 330, max: 390 }, // 5:30–6:30/km
  { label: "Z3", name: "Tempo",     min: 285, max: 330 }, // 4:45–5:30/km
  { label: "Z4", name: "Threshold", min: 250, max: 285 }, // 4:10–4:45/km
];

function recPower(power: number | undefined): Run2MaxRecord {
  return { timestamp: new Date(), power } as Run2MaxRecord;
}

function recHr(heartRate: number | undefined): Run2MaxRecord {
  return { timestamp: new Date(), heartRate } as Run2MaxRecord;
}

function recSpeed(speed: number | undefined): Run2MaxRecord {
  return { timestamp: new Date(), speed } as Run2MaxRecord;
}

// ---------------------------------------------------------------------------
// classifyZone (generic)
// ---------------------------------------------------------------------------

describe("classifyZone", () => {
  it("returns zone label when value is within bounds", () => {
    expect(classifyZone(220, POWER_ZONES)).toBe("E");
    expect(classifyZone(255, POWER_ZONES)).toBe("M");
    expect(classifyZone(295, POWER_ZONES)).toBe("THRESH");
  });

  it("returns zone label at exact boundaries", () => {
    expect(classifyZone(204, POWER_ZONES)).toBe("E");
    expect(classifyZone(233, POWER_ZONES)).toBe("E");
    expect(classifyZone(301, POWER_ZONES)).toBe("THRESH");
  });

  it("returns 'below <label>' when value is below all zones", () => {
    expect(classifyZone(100, POWER_ZONES)).toBe("below E");
    expect(classifyZone(203, POWER_ZONES)).toBe("below E");
  });

  it("returns 'above <label>' when value is above all zones", () => {
    expect(classifyZone(302, POWER_ZONES)).toBe("above THRESH");
    expect(classifyZone(500, POWER_ZONES)).toBe("above THRESH");
  });

  it("returns '<lower>→<upper>' for gap between zones", () => {
    expect(classifyZone(240, POWER_ZONES)).toBe("E\u2192M");
    expect(classifyZone(234, POWER_ZONES)).toBe("E\u2192M");
  });

  it("handles unsorted zones input", () => {
    const reversed = [...POWER_ZONES].reverse();
    expect(classifyZone(220, reversed)).toBe("E");
    expect(classifyZone(240, reversed)).toBe("E\u2192M");
  });

  it("classifies HR values correctly", () => {
    expect(classifyZone(140, HR_ZONES)).toBe("Z2");
    expect(classifyZone(160, HR_ZONES)).toBe("Z3");
    expect(classifyZone(190, HR_ZONES)).toBe("Z5");
  });

  it("classifies pace (sec/km) values correctly", () => {
    expect(classifyZone(420, PACE_ZONES)).toBe("Z1"); // 7:00/km → Recovery
    expect(classifyZone(360, PACE_ZONES)).toBe("Z2"); // 6:00/km → Aerobic
    expect(classifyZone(300, PACE_ZONES)).toBe("Z3"); // 5:00/km → Tempo
  });
});

// ---------------------------------------------------------------------------
// classifyPowerZone (backward compat alias)
// ---------------------------------------------------------------------------

describe("classifyPowerZone", () => {
  it("is an alias for classifyZone — same results", () => {
    expect(classifyPowerZone(220, POWER_ZONES)).toBe(classifyZone(220, POWER_ZONES));
    expect(classifyPowerZone(100, POWER_ZONES)).toBe(classifyZone(100, POWER_ZONES));
    expect(classifyPowerZone(302, POWER_ZONES)).toBe(classifyZone(302, POWER_ZONES));
  });
});

// ---------------------------------------------------------------------------
// computeZoneDistribution (generalized, with accessor)
// ---------------------------------------------------------------------------

describe("computeZoneDistribution", () => {
  it("uses the provided accessor to extract values", () => {
    // Use a custom accessor that always returns 220 (E zone)
    const records = [recPower(undefined), recPower(undefined)]; // power is undefined
    const result = computeZoneDistribution(records, POWER_ZONES, 1, () => 220);

    const eZone = result.find((r) => r.label === "E")!;
    expect(eZone.seconds).toBe(2);
  });

  it("skips records where accessor returns null", () => {
    const records = [recPower(220), recPower(undefined)];
    const result = computeZoneDistribution(records, POWER_ZONES, 1, (r) => r.power ?? null);
    const total = result.reduce((s, r) => s + r.seconds, 0);
    expect(total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computePowerZoneDistribution
// ---------------------------------------------------------------------------

describe("computePowerZoneDistribution", () => {
  it("all configured zones appear even with 0 time", () => {
    const records = [recPower(220), recPower(220)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);

    expect(result.length).toBeGreaterThanOrEqual(POWER_ZONES.length);
    for (const zone of POWER_ZONES) {
      expect(result.find((r) => r.label === zone.label)).toBeDefined();
    }
  });

  it("computes correct percentages", () => {
    const records = [recPower(220), recPower(220), recPower(220), recPower(255)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);

    const eZone = result.find((r) => r.label === "E")!;
    const mZone = result.find((r) => r.label === "M")!;
    expect(eZone.seconds).toBe(3);
    expect(eZone.percentage).toBe(75);
    expect(mZone.seconds).toBe(1);
    expect(mZone.percentage).toBe(25);
  });

  it("percentages sum to 100", () => {
    const records = [recPower(220), recPower(255), recPower(265), recPower(295)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);
    const total = result.reduce((sum, r) => sum + r.percentage, 0);
    expect(total).toBeCloseTo(100);
  });

  it("gap/out-of-range rows only appear if time > 0", () => {
    const records = [recPower(220)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);
    const extraRows = result.filter(
      (r) => !POWER_ZONES.some((z) => z.label === r.label),
    );
    expect(extraRows).toHaveLength(0);
  });

  it("includes gap row when power falls in gap", () => {
    const records = [recPower(240)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);
    const gapRow = result.find((r) => r.label === "E\u2192M");
    expect(gapRow).toBeDefined();
    expect(gapRow!.seconds).toBe(1);
  });

  it("includes below/above rows when power is out of range", () => {
    const records = [recPower(100), recPower(500)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);
    expect(result.find((r) => r.label === "below E")).toBeDefined();
    expect(result.find((r) => r.label === "above THRESH")).toBeDefined();
  });

  it("respects intervalSeconds for downsampled data", () => {
    const records = [recPower(220), recPower(220)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 10);
    const eZone = result.find((r) => r.label === "E")!;
    expect(eZone.seconds).toBe(20);
  });

  it("skips records with null power", () => {
    const records = [recPower(220), recPower(undefined)];
    const result = computePowerZoneDistribution(records, POWER_ZONES, 1);
    const total = result.reduce((sum, r) => sum + r.seconds, 0);
    expect(total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeHrZoneDistribution
// ---------------------------------------------------------------------------

describe("computeHrZoneDistribution", () => {
  it("classifies by heartRate field", () => {
    const records = [recHr(140), recHr(140), recHr(160)]; // 2 Z2, 1 Z3
    const result = computeHrZoneDistribution(records, HR_ZONES, 1);

    const z2 = result.find((r) => r.label === "Z2")!;
    const z3 = result.find((r) => r.label === "Z3")!;
    expect(z2.seconds).toBe(2);
    expect(z3.seconds).toBe(1);
  });

  it("all configured HR zones appear", () => {
    const records = [recHr(140)];
    const result = computeHrZoneDistribution(records, HR_ZONES, 1);
    for (const zone of HR_ZONES) {
      expect(result.find((r) => r.label === zone.label)).toBeDefined();
    }
  });

  it("skips records with null heartRate", () => {
    const records = [recHr(140), recHr(undefined)];
    const result = computeHrZoneDistribution(records, HR_ZONES, 1);
    const total = result.reduce((s, r) => s + r.seconds, 0);
    expect(total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computePaceZoneDistribution
// ---------------------------------------------------------------------------

describe("computePaceZoneDistribution", () => {
  it("converts speed (m/s) to pace (sec/km) and classifies", () => {
    // 2.381 m/s → ~420 sec/km → Z1 Recovery
    // 2.778 m/s → ~360 sec/km → Z2 Aerobic
    const r1 = recSpeed(1000 / 420); // exactly 420 sec/km
    const r2 = recSpeed(1000 / 360); // exactly 360 sec/km
    const records = [r1, r1, r2];    // 2 Z1, 1 Z2

    const result = computePaceZoneDistribution(records, PACE_ZONES, 1);
    const z1 = result.find((r) => r.label === "Z1")!;
    const z2 = result.find((r) => r.label === "Z2")!;
    expect(z1.seconds).toBe(2);
    expect(z2.seconds).toBe(1);
  });

  it("skips records with null or zero speed", () => {
    const records = [recSpeed(1000 / 420), recSpeed(undefined), recSpeed(0)];
    const result = computePaceZoneDistribution(records, PACE_ZONES, 1);
    const total = result.reduce((s, r) => s + r.seconds, 0);
    expect(total).toBe(1);
  });

  it("all configured pace zones appear", () => {
    const records = [recSpeed(1000 / 420)];
    const result = computePaceZoneDistribution(records, PACE_ZONES, 1);
    for (const zone of PACE_ZONES) {
      expect(result.find((r) => r.label === zone.label)).toBeDefined();
    }
  });
});
