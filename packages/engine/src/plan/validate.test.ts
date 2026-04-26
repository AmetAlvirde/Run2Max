import { describe, it, expect } from "vitest";
import { parsePlan } from "./schema.js";
import { validatePlan } from "./validate.js";

function makePlan(weeks: object[]) {
  return parsePlan({
    schema_version: 1,
    block: "build",
    start: "2026-05-04",
    mesocycles: [{ name: "CANAL", fractals: [{ weeks }] }],
  });
}

describe("validatePlan", () => {
  it("returns no errors for a valid plan", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "LL" },
    ]);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("returns error when reason is set on non-INC/DNF week", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04", executed: "L", reason: "illness" },
    ]);
    const errors = validatePlan(plan);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("REASON_WITHOUT_DEVIATION");
  });

  it("returns error when INC or DNF is used as planned type", () => {
    const plan = makePlan([{ planned: "INC", start: "2026-05-04" }]);
    const errors = validatePlan(plan);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.code).toBe("EXECUTED_ONLY_AS_PLANNED");
  });

  it("returns error when testingPeriod is on a non-test week", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04", testing_period: { lthr: 173 } },
    ]);
    const errors = validatePlan(plan);
    expect(errors.some(e => e.code === "TESTING_PERIOD_ON_NON_TEST_WEEK")).toBe(true);
  });

  it("allows testingPeriod on INC test week", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04", executed: "INC", testing_period: { lthr: 173 } },
    ]);
    expect(validatePlan(plan)).toHaveLength(0);
  });

  it("returns error when testingPeriod is on DNF test week", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04", executed: "DNF", testing_period: { lthr: 173 } },
    ]);
    const errors = validatePlan(plan);
    expect(errors.some(e => e.code === "TESTING_PERIOD_ON_DNF_WEEK")).toBe(true);
  });

  it("returns error when CP is recorded but Ta was DNF", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04", executed: "DNF" },
      { planned: "Tb", start: "2026-05-11", executed: "Tb", testing_period: { cp: 302 } },
    ]);
    const errors = validatePlan(plan);
    expect(errors.some(e => e.code === "CP_WITHOUT_TA_EXECUTION")).toBe(true);
  });

  it("returns error when CP is recorded but Ta was INC without testingPeriod", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04", executed: "INC" },
      { planned: "Tb", start: "2026-05-11", executed: "Tb", testing_period: { cp: 302 } },
    ]);
    const errors = validatePlan(plan);
    expect(errors.some(e => e.code === "CP_WITHOUT_TA_TEST_PERIOD")).toBe(true);
  });

  it("returns multiple errors at once", () => {
    const plan = makePlan([
      { planned: "INC", start: "2026-05-04", reason: "illness" },
      { planned: "DNF", start: "2026-05-11" },
    ]);
    const errors = validatePlan(plan);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
