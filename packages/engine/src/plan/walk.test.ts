import { describe, expect, it } from "vitest";
import { walkPlan } from "./walk.js";
import type { Plan } from "./types.js";

describe("walkPlan", () => {
  it("returns context for a single week", () => {
    const plan: Plan = {
      schemaVersion: 1,
      block: "build",
      start: "2026-01-05",
      mesocycles: [
        {
          name: "BASE",
          fractals: [{ weeks: [{ planned: "L", start: "2026-01-05" }] }],
        },
      ],
    };

    const weeks = walkPlan(plan);

    expect(weeks).toEqual([
      {
        absoluteIndex: 1,
        totalWeeks: 1,
        mesocycleName: "BASE",
        mesocycleIndex: 0,
        fractalIndex: 0,
        totalFractals: 1,
        weekIndex: 0,
        week: plan.mesocycles[0]!.fractals[0]!.weeks[0],
      },
    ]);
  });

  it("walks all weeks with stable totalWeeks and absoluteIndex ordering", () => {
    const plan: Plan = {
      schemaVersion: 1,
      block: "build",
      start: "2026-01-05",
      mesocycles: [
        {
          name: "BASE",
          fractals: [
            {
              weeks: [
                { planned: "L", start: "2026-01-05" },
                { planned: "LL", start: "2026-01-12" },
              ],
            },
            {
              weeks: [{ planned: "D", start: "2026-01-19" }],
            },
          ],
        },
        {
          name: "TAPER",
          fractals: [
            {
              weeks: [
                { planned: "P", start: "2026-01-26" },
                { planned: "R", start: "2026-02-02" },
              ],
            },
          ],
        },
      ],
    };

    const weeks = walkPlan(plan);

    expect(weeks).toHaveLength(5);
    expect(weeks.map((w) => w.absoluteIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(weeks.map((w) => w.totalWeeks)).toEqual([5, 5, 5, 5, 5]);

    expect(weeks[2]).toMatchObject({
      absoluteIndex: 3,
      totalWeeks: 5,
      mesocycleName: "BASE",
      mesocycleIndex: 0,
      fractalIndex: 1,
      totalFractals: 2,
      weekIndex: 0,
    });
    expect(weeks[2]!.week).toBe(plan.mesocycles[0]!.fractals[1]!.weeks[0]);
  });

  it("returns an empty array for plans with no mesocycles", () => {
    const plan = {
      schemaVersion: 1,
      block: "build",
      start: "2026-01-05",
      mesocycles: [],
    } as Plan;

    expect(walkPlan(plan)).toEqual([]);
  });
});
