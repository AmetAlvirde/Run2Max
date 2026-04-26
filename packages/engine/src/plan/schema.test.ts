import { describe, it, expect } from "vitest";
import {
  parsePlan,
  PLANNED_WEEK_TYPES,
  EXECUTED_ONLY_TYPES,
  ALL_WEEK_TYPES,
  REASON_CATEGORIES,
  KNOWN_DISTANCES,
} from "./schema.js";

const minimalPlan = {
  schema_version: 1,
  block: "build",
  start: "2026-05-04",
  mesocycles: [
    {
      name: "CANAL",
      fractals: [
        {
          weeks: [{ planned: "L", start: "2026-05-04" }],
        },
      ],
    },
  ],
};

const fullPlan = {
  schema_version: 1,
  block: "build",
  goal: "Half Marathon Santiago",
  distance: "half-marathon",
  race_date: "2026-10-18",
  start: "2026-05-04",
  mesocycles: [
    {
      name: "CANAL",
      fractals: [
        {
          weeks: [
            { planned: "L", start: "2026-05-04", executed: "L" },
            {
              planned: "LLL",
              start: "2026-05-11",
              executed: "INC",
              reason: "illness",
              note: "stomach flu",
            },
            {
              planned: "Ta",
              start: "2026-05-18",
              executed: "Ta",
              testing_period: {
                cp: 302,
                e_ftp: 298,
                lthr: 173,
                zones: {
                  E: { min: 0, max: 214 },
                  M: { min: 215, max: 255 },
                },
              },
            },
          ],
        },
      ],
    },
  ],
};

describe("parsePlan", () => {
  it("accepts a minimal plan with one mesocycle and one week", () => {
    const result = parsePlan(minimalPlan);
    expect(result.block).toBe("build");
    expect(result.start).toBe("2026-05-04");
    expect(result.mesocycles).toHaveLength(1);
    expect(result.mesocycles[0]!.fractals[0]!.weeks).toHaveLength(1);
  });

  it("accepts a full plan with all optional fields", () => {
    const result = parsePlan(fullPlan);
    expect(result.goal).toBe("Half Marathon Santiago");
    expect(result.distance).toBe("half-marathon");
    expect(result.raceDate).toBe("2026-10-18");
    const week = result.mesocycles[0]!.fractals[0]!.weeks[2]!;
    expect(week.testingPeriod?.cp).toBe(302);
    expect(week.testingPeriod?.lthr).toBe(173);
    expect(week.note).toBeUndefined();
  });

  it("transforms snake_case keys to camelCase", () => {
    const result = parsePlan(fullPlan);
    expect(result.raceDate).toBe("2026-10-18");
    const week = result.mesocycles[0]!.fractals[0]!.weeks[2]!;
    expect(week.testingPeriod).toBeDefined();
    expect(week.testingPeriod?.eFtp).toBe(298);
  });

  it("throws when schemaVersion is missing", () => {
    const { schema_version: _, ...withoutVersion } = minimalPlan;
    expect(() => parsePlan(withoutVersion)).toThrow();
  });

  it("throws when schemaVersion is not 1", () => {
    expect(() => parsePlan({ ...minimalPlan, schema_version: 2 })).toThrow();
  });

  it("throws when block name is missing", () => {
    const { block: _, ...withoutBlock } = minimalPlan;
    expect(() => parsePlan(withoutBlock)).toThrow();
  });

  it("throws when start date is missing", () => {
    const { start: _, ...withoutStart } = minimalPlan;
    expect(() => parsePlan(withoutStart)).toThrow();
  });

  it("throws when mesocycles is empty", () => {
    expect(() => parsePlan({ ...minimalPlan, mesocycles: [] })).toThrow();
  });

  it("throws when a fractal has no weeks", () => {
    expect(() =>
      parsePlan({
        ...minimalPlan,
        mesocycles: [{ name: "CANAL", fractals: [{ weeks: [] }] }],
      })
    ).toThrow();
  });

  it("throws when a week is missing planned", () => {
    expect(() =>
      parsePlan({
        ...minimalPlan,
        mesocycles: [{ name: "CANAL", fractals: [{ weeks: [{ start: "2026-05-04" }] }] }],
      })
    ).toThrow();
  });

  it("throws when a week is missing start", () => {
    expect(() =>
      parsePlan({
        ...minimalPlan,
        mesocycles: [{ name: "CANAL", fractals: [{ weeks: [{ planned: "L" }] }] }],
      })
    ).toThrow();
  });

  it("accepts weeks with executed matching planned", () => {
    const result = parsePlan({
      ...minimalPlan,
      mesocycles: [
        { name: "CANAL", fractals: [{ weeks: [{ planned: "L", start: "2026-05-04", executed: "L" }] }] },
      ],
    });
    expect(result.mesocycles[0]!.fractals[0]!.weeks[0]!.executed).toBe("L");
  });

  it("accepts weeks with INC/DNF as executed", () => {
    const result = parsePlan({
      ...minimalPlan,
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            {
              weeks: [
                { planned: "L", start: "2026-05-04", executed: "INC", reason: "illness" },
                { planned: "LL", start: "2026-05-11", executed: "DNF", reason: "injury" },
              ],
            },
          ],
        },
      ],
    });
    expect(result.mesocycles[0]!.fractals[0]!.weeks[0]!.executed).toBe("INC");
    expect(result.mesocycles[0]!.fractals[0]!.weeks[1]!.executed).toBe("DNF");
  });

  it("accepts testingPeriod with partial fields", () => {
    const result = parsePlan({
      ...minimalPlan,
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            { weeks: [{ planned: "Ta", start: "2026-05-04", testing_period: { cp: 302 } }] },
          ],
        },
      ],
    });
    expect(result.mesocycles[0]!.fractals[0]!.weeks[0]!.testingPeriod?.cp).toBe(302);
    expect(result.mesocycles[0]!.fractals[0]!.weeks[0]!.testingPeriod?.lthr).toBeUndefined();
  });

  it("accepts testingPeriod zones as open record", () => {
    const result = parsePlan({
      ...minimalPlan,
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            {
              weeks: [
                {
                  planned: "Ta",
                  start: "2026-05-04",
                  testing_period: {
                    zones: {
                      SPRINT: { min: 400, max: 999 },
                      CUSTOM: { min: 0, max: 100 },
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    const zones = result.mesocycles[0]!.fractals[0]!.weeks[0]!.testingPeriod?.zones;
    expect(zones?.SPRINT).toEqual({ min: 400, max: 999 });
    expect(zones?.CUSTOM).toEqual({ min: 0, max: 100 });
  });

  it("accepts unknown distance strings", () => {
    const result = parsePlan({ ...minimalPlan, distance: "ultramarathon" });
    expect(result.distance).toBe("ultramarathon");
  });

  it("exports const arrays with correct values", () => {
    expect(PLANNED_WEEK_TYPES).toContain("L");
    expect(PLANNED_WEEK_TYPES).toContain("Ta");
    expect(PLANNED_WEEK_TYPES).not.toContain("INC");
    expect(EXECUTED_ONLY_TYPES).toContain("INC");
    expect(EXECUTED_ONLY_TYPES).toContain("DNF");
    expect(ALL_WEEK_TYPES).toContain("L");
    expect(ALL_WEEK_TYPES).toContain("INC");
    expect(REASON_CATEGORIES).toContain("illness");
    expect(KNOWN_DISTANCES).toContain("marathon");
  });
});
