import { describe, it, expect } from "vitest";
import { parsePlan } from "../plan/schema.js";
import { getPlanStatus } from "../plan/status.js";
import { makeFullPlan, makeSingleFractalPlan } from "../plan/status.fixtures.js";
import type { DeviationReport } from "../plan/detect.js";
import { formatDefaultView, formatFullView } from "./plan.js";

const TODAY = "2026-07-10";

describe("formatDefaultView", () => {
  it("formats default view with header, position, and milestones", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatDefaultView(status);

    expect(output).toContain("BUILD — Half Marathon Santiago (2026-10-18)");
    expect(output).toContain("Mesocycle: CANAL | Fractal 2 of 2");
    expect(output).toContain("Week 7/16 — L (2026-06-15)");
    expect(output).toContain("Next:");
  });

  it("shows unsynced past weeks section when present", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatDefaultView(status);

    expect(output).toContain("Unsynced:");
    expect(output).toContain("Week 8/16 — LL (2026-06-22)");
    expect(output).toContain("Week 9/16 — LLL (2026-06-29)");
  });

  it("shows plan complete message when all weeks have executed", () => {
    const plan = makeSingleFractalPlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "LL" },
    ]);
    const status = getPlanStatus(plan, "2026-06-01");
    const output = formatDefaultView(status);
    expect(output).toContain("Plan complete");
    expect(output).toContain("2");
  });
});

describe("formatFullView", () => {
  it("formats full view with all mesocycles and fractal rows", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatFullView(status);

    expect(output).toContain("BUILD — Half Marathon Santiago (2026-10-18)");
    expect(output).toContain("CANAL");
    expect(output).toContain("TAPER");
    expect(output).toContain("F1:");
    expect(output).toContain("F2:");
  });

  it("full view shows current week marker", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatFullView(status);

    expect(output).toContain("^ current");
  });

  it("formats ok weeks as 'planned ok'", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatFullView(status);

    expect(output).toContain("L ok");
    expect(output).toContain("LL ok");
  });

  it("formats deviated weeks as 'executed[planned/reason]'", () => {
    const plan = parsePlan({
      schema_version: 1,
      block: "build",
      start: "2026-05-04",
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            {
              weeks: [
                {
                  planned: "LLL",
                  start: "2026-05-04",
                  executed: "INC",
                  reason: "illness",
                },
                { planned: "D", start: "2026-05-11" },
              ],
            },
          ],
        },
      ],
    });
    const status = getPlanStatus(plan, "2026-05-14");
    const output = formatFullView(status);
    expect(output).toContain("INC[LLL/illness]");
  });

  it("formats unsynced past weeks with ? marker", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatFullView(status);
    expect(output).toContain("LL?");
    expect(output).toContain("LLL?");
  });

  it("formats future weeks with . marker", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatFullView(status);
    expect(output).toContain("D .");
    expect(output).toContain("P .");
  });
});

const CLEAN_REPORT: DeviationReport = {
  suggestINC: false,
  suggestDNF: false,
  missingLongRunDay: undefined,
  completedRuns: 5,
  expectedRuns: 5,
  incThreshold: 2,
};

const ANOMALOUS_REPORT: DeviationReport = {
  suggestINC: true,
  suggestDNF: false,
  missingLongRunDay: "sunday",
  completedRuns: 2,
  expectedRuns: 5,
  incThreshold: 2,
};

describe("deviation surfacing in default view", () => {
  it("shows unsynced weeks with anomalies separately from clean unsynced weeks", () => {
    const plan = makeFullPlan();
    const deviationReports = new Map<number, DeviationReport>([
      [8, ANOMALOUS_REPORT],
      [9, CLEAN_REPORT],
    ]);
    const status = getPlanStatus(plan, TODAY, { deviationReports });
    const output = formatDefaultView(status);

    expect(output).toContain("Unsynced with anomalies:");
    expect(output).toContain("Week 8/16 — LL (2026-06-22)");
    expect(output).toContain("Unsynced:");
    expect(output).toContain("Week 9/16 — LLL (2026-06-29)");
  });

  it("shows anomaly detail line with run count and missing long run day", () => {
    const plan = makeFullPlan();
    const deviationReports = new Map<number, DeviationReport>([[8, ANOMALOUS_REPORT]]);
    const status = getPlanStatus(plan, TODAY, { deviationReports });
    const output = formatDefaultView(status);

    expect(output).toContain("2/5 runs");
    expect(output).toContain("missing long run day (sunday)");
  });

  it("omits anomalies section when no anomalous unsynced weeks", () => {
    const plan = makeFullPlan();
    const deviationReports = new Map<number, DeviationReport>([
      [8, CLEAN_REPORT],
      [9, CLEAN_REPORT],
    ]);
    const status = getPlanStatus(plan, TODAY, { deviationReports });
    const output = formatDefaultView(status);

    expect(output).not.toContain("Unsynced with anomalies:");
    expect(output).toContain("Unsynced:");
  });

  it("omits clean unsynced section when all unsynced weeks have anomalies", () => {
    const plan = makeFullPlan();
    const deviationReports = new Map<number, DeviationReport>([
      [8, ANOMALOUS_REPORT],
      [9, ANOMALOUS_REPORT],
    ]);
    const status = getPlanStatus(plan, TODAY, { deviationReports });
    const output = formatDefaultView(status);

    expect(output).toContain("Unsynced with anomalies:");
    const lines = output.split("\n");
    expect(lines.some((l) => l === "Unsynced:")).toBe(false);
  });

  it("shows plain Unsynced section when no deviation reports provided (backward compat)", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatDefaultView(status);

    expect(output).toContain("Unsynced:");
    expect(output).not.toContain("Unsynced with anomalies:");
  });
});

describe("deviation surfacing in full view (?/??)", () => {
  it("uses ?? marker for unsynced past weeks with anomalies", () => {
    const plan = makeFullPlan();
    const deviationReports = new Map<number, DeviationReport>([[8, ANOMALOUS_REPORT]]);
    const status = getPlanStatus(plan, TODAY, { deviationReports });
    const output = formatFullView(status);

    expect(output).toContain("LL??");
  });

  it("uses ? marker for unsynced past weeks without anomalies", () => {
    const plan = makeFullPlan();
    const deviationReports = new Map<number, DeviationReport>([
      [8, ANOMALOUS_REPORT],
      [9, CLEAN_REPORT],
    ]);
    const status = getPlanStatus(plan, TODAY, { deviationReports });
    const output = formatFullView(status);

    expect(output).toContain("LL??");
    expect(output).toContain("LLL?");
    expect(output).not.toContain("LLL??");
  });

  it("uses ? for all unsynced past weeks when no deviation reports provided", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const output = formatFullView(status);

    expect(output).toContain("LL?");
    expect(output).toContain("LLL?");
    expect(output).not.toContain("??");
  });
});
