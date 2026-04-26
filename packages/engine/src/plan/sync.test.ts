import { describe, it, expect } from "vitest";
import { parsePlan } from "./schema.js";
import { validatePlan } from "./validate.js";
import { syncWeek } from "./sync.js";
import type { SyncData } from "./sync.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePlan(weeks: object[]) {
  return parsePlan({
    schema_version: 1,
    block: "build",
    start: "2026-05-04",
    mesocycles: [{ name: "CANAL", fractals: [{ weeks }] }],
  });
}

function makeMultiFractalPlan(fractalWeeks: object[][]) {
  return parsePlan({
    schema_version: 1,
    block: "build",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: fractalWeeks.map((weeks) => ({ weeks })),
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// syncWeek — happy paths
// ---------------------------------------------------------------------------

describe("syncWeek", () => {
  it("sets executed to match planned on happy path", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04" },
      { planned: "LL", start: "2026-05-11" },
    ]);

    const updated = syncWeek(plan, 1, { executed: "L" });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("L");
    expect(week.reason).toBeUndefined();
    expect(week.note).toBeUndefined();
  });

  it("sets executed, reason, and note on INC week", () => {
    const plan = makePlan([
      { planned: "LLL", start: "2026-05-04" },
      { planned: "D", start: "2026-05-11" },
    ]);

    const updated = syncWeek(plan, 1, {
      executed: "INC",
      reason: "illness",
      note: "stomach flu, only ran tuesday",
    });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("INC");
    expect(week.reason).toBe("illness");
    expect(week.note).toBe("stomach flu, only ran tuesday");
  });

  it("sets executed to DNF with reason", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04" },
      { planned: "LL", start: "2026-05-11" },
    ]);

    const updated = syncWeek(plan, 1, { executed: "DNF", reason: "injury" });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("DNF");
    expect(week.reason).toBe("injury");
  });

  it("adds testingPeriod on executed test week", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04" },
    ]);

    const testPeriod = { cp: 302, eFtp: 298, lthr: 173 };
    const updated = syncWeek(plan, 1, { executed: "Ta", testingPeriod: testPeriod });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("Ta");
    expect(week.testingPeriod).toEqual(testPeriod);
  });

  it("adds testingPeriod on INC test week when test run was completed", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04" },
    ]);

    const testPeriod = { cp: 302, eFtp: 298, lthr: 173 };
    const updated = syncWeek(plan, 1, {
      executed: "INC",
      reason: "illness",
      testingPeriod: testPeriod,
      testRunCompleted: true,
    });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("INC");
    expect(week.testingPeriod).toEqual(testPeriod);
  });

  it("omits testingPeriod on DNF test week", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04" },
    ]);

    const updated = syncWeek(plan, 1, {
      executed: "DNF",
      reason: "injury",
      testingPeriod: { cp: 302, eFtp: 298 },
    });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("DNF");
    expect(week.testingPeriod).toBeUndefined();
  });

  it("omits testingPeriod on INC test week when test run was not completed", () => {
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04" },
    ]);

    const updated = syncWeek(plan, 1, {
      executed: "INC",
      reason: "illness",
      testingPeriod: { cp: 302, eFtp: 298 },
      testRunCompleted: false,
    });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("INC");
    expect(week.testingPeriod).toBeUndefined();
  });

  it("attaches testingPeriod to last test week in Ta/Tb sequence", () => {
    // When syncing Ta and Tb follows in the same fractal, testingPeriod
    // should be attached to Tb (the last test week), not Ta.
    const plan = makePlan([
      { planned: "Ta", start: "2026-05-04" },
      { planned: "Tb", start: "2026-05-11" },
      { planned: "D", start: "2026-05-18" },
    ]);

    const testPeriod = { cp: 302, eFtp: 298, lthr: 173 };
    const updated = syncWeek(plan, 1, { executed: "Ta", testingPeriod: testPeriod });

    const weeks = updated.mesocycles[0]!.fractals[0]!.weeks;
    // testingPeriod should be on Tb (index 1), not on Ta (index 0)
    expect(weeks[0]!.testingPeriod).toBeUndefined();
    expect(weeks[1]!.testingPeriod).toEqual(testPeriod);
  });

  it("with note on matching week", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04" },
      { planned: "LL", start: "2026-05-11" },
    ]);

    const updated = syncWeek(plan, 1, {
      executed: "L",
      note: "felt great, added strides",
    });

    const week = updated.mesocycles[0]!.fractals[0]!.weeks[0]!;
    expect(week.executed).toBe("L");
    expect(week.note).toBe("felt great, added strides");
    expect(week.reason).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Rejections
  // ---------------------------------------------------------------------------

  it("rejects future week", () => {
    // Week 2 is future (week 1 hasn't been synced yet)
    const plan = makePlan([
      { planned: "L", start: "2026-05-04" },
      { planned: "LL", start: "2026-05-11" },
    ]);

    expect(() => syncWeek(plan, 2, { executed: "LL" })).toThrow();
  });

  it("rejects already-synced week", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11" },
    ]);

    expect(() => syncWeek(plan, 1, { executed: "L" })).toThrow();
  });

  it("preserves existing synced weeks", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "LL" },
      { planned: "LLL", start: "2026-05-18" },
      { planned: "D", start: "2026-05-25" },
    ]);

    const updated = syncWeek(plan, 3, { executed: "LLL" });

    const weeks = updated.mesocycles[0]!.fractals[0]!.weeks;
    expect(weeks[0]!.executed).toBe("L");
    expect(weeks[1]!.executed).toBe("LL");
    expect(weeks[2]!.executed).toBe("LLL");
    expect(weeks[3]!.executed).toBeUndefined();
  });

  it("updated plan passes parsePlan and validatePlan", () => {
    const plan = makePlan([
      { planned: "L", start: "2026-05-04" },
      { planned: "LL", start: "2026-05-11" },
    ]);

    const updated = syncWeek(plan, 1, { executed: "INC", reason: "illness" });

    // parsePlan would throw if the structure is invalid
    const reparsed = parsePlan({
      schema_version: 1,
      block: updated.block,
      start: updated.start,
      mesocycles: updated.mesocycles.map((m) => ({
        name: m.name,
        fractals: m.fractals.map((f) => ({
          weeks: f.weeks.map((w) => ({
            planned: w.planned,
            start: w.start,
            ...(w.executed !== undefined ? { executed: w.executed } : {}),
            ...(w.reason !== undefined ? { reason: w.reason } : {}),
            ...(w.note !== undefined ? { note: w.note } : {}),
            ...(w.testingPeriod !== undefined ? { testing_period: w.testingPeriod } : {}),
          })),
        })),
      })),
    });

    const diagnostics = validatePlan(reparsed);
    expect(diagnostics).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Multi-fractal and cross-mesocycle week indexing
  // ---------------------------------------------------------------------------

  it("syncs week in second fractal by absolute index", () => {
    const plan = makeMultiFractalPlan([
      [
        { planned: "L", start: "2026-05-04", executed: "L" },
        { planned: "LL", start: "2026-05-11", executed: "LL" },
      ],
      [
        { planned: "LLL", start: "2026-05-18" }, // week 3 — current
        { planned: "D", start: "2026-05-25" },
      ],
    ]);

    const updated = syncWeek(plan, 3, { executed: "LLL" });

    const week = updated.mesocycles[0]!.fractals[1]!.weeks[0]!;
    expect(week.executed).toBe("LLL");
  });
});
