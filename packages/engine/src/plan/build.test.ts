import { describe, it, expect } from "vitest";
import { buildPlanFromTemplate } from "./build.js";
import { getBuiltinTemplate } from "./templates/builtin.js";
import { parsePlan } from "./schema.js";
import { validatePlan } from "./validate.js";

const MONDAY = "2026-05-04";

describe("buildPlanFromTemplate", () => {
  it("builds a plan from a 1-meso template with correct week count", () => {
    const template = getBuiltinTemplate("1-meso")!;
    const plan = buildPlanFromTemplate(template, { block: "build", start: MONDAY });
    const weeks = plan.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks));
    expect(weeks).toHaveLength(6);
  });

  it("assigns sequential 7-day start dates from --start", () => {
    const template = getBuiltinTemplate("1-meso")!;
    const plan = buildPlanFromTemplate(template, { block: "build", start: MONDAY });
    const weeks = plan.mesocycles[0]!.fractals[0]!.weeks;
    expect(weeks[0]!.start).toBe("2026-05-04");
    expect(weeks[1]!.start).toBe("2026-05-11");
    expect(weeks[2]!.start).toBe("2026-05-18");
    expect(weeks[5]!.start).toBe("2026-06-08");
  });

  it("throws when start date does not fall on weekStart day", () => {
    const template = getBuiltinTemplate("1-meso")!;
    expect(() =>
      buildPlanFromTemplate(template, { block: "build", start: "2026-05-05" })
    ).toThrow(/does not fall on monday/);
  });

  it("uses monday as default weekStart", () => {
    const template = getBuiltinTemplate("1-meso")!;
    expect(() =>
      buildPlanFromTemplate(template, { block: "build", start: MONDAY })
    ).not.toThrow();
    expect(() =>
      buildPlanFromTemplate(template, { block: "build", start: "2026-05-05" })
    ).toThrow();
  });

  it("includes block, goal, distance, raceDate when provided", () => {
    const template = getBuiltinTemplate("2-meso-race")!;
    const plan = buildPlanFromTemplate(template, {
      block: "build",
      start: MONDAY,
      goal: "Half Marathon Santiago",
      distance: "half-marathon",
      raceDate: "2026-08-17",
    });
    expect(plan.block).toBe("build");
    expect(plan.goal).toBe("Half Marathon Santiago");
    expect(plan.distance).toBe("half-marathon");
    expect(plan.raceDate).toBe("2026-08-17");
  });

  it("omits goal, distance, raceDate when not provided", () => {
    const template = getBuiltinTemplate("bridge")!;
    const plan = buildPlanFromTemplate(template, { block: "bridge-block", start: MONDAY });
    expect(plan.goal).toBeUndefined();
    expect(plan.distance).toBeUndefined();
    expect(plan.raceDate).toBeUndefined();
  });

  it("produces a plan that passes parsePlan", () => {
    const template = getBuiltinTemplate("1-meso")!;
    const plan = buildPlanFromTemplate(template, { block: "build", start: MONDAY });
    expect(() => parsePlan(plan)).not.toThrow();
  });

  it("produces a plan that passes validatePlan", () => {
    const template = getBuiltinTemplate("1-meso")!;
    const plan = buildPlanFromTemplate(template, { block: "build", start: MONDAY });
    const diagnostics = validatePlan(plan);
    expect(diagnostics).toHaveLength(0);
  });
});
