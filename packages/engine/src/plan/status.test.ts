import { describe, it, expect } from "vitest";
import { parsePlan } from "./schema.js";
import { getPlanStatus, formatDefaultView, formatFullView } from "./status.js";

// Fixed date for deterministic tests
const TODAY = "2026-07-10";

function makeSingleFractalPlan(weeks: object[], extras?: object) {
  return parsePlan({
    schema_version: 1,
    block: "build",
    start: "2026-05-04",
    ...extras,
    mesocycles: [{ name: "CANAL", fractals: [{ weeks }] }],
  });
}

/**
 * Multi-mesocycle plan used for structural and full-view tests.
 * Week sequence (absolute index):
 *   CANAL / F1: L(1)ok  LL(2)ok  LLL(3)ok  D(4)ok  Ta(5)ok  Tb(6)ok
 *   CANAL / F2: L(7)current  LL(8)unsynced_past  LLL(9)unsynced_past
 *               D(10)future  Ta(11)future  Tb(12)future
 *   TAPER / F1: P(13).  P(14).  R(15).  N(16).
 *
 * TODAY = "2026-07-10"
 * week end dates after current:
 *   LL  starts 2026-06-22, end 2026-06-29 → past   → unsynced_past
 *   LLL starts 2026-06-29, end 2026-07-06 → past   → unsynced_past
 *   D   starts 2026-07-06, end 2026-07-13 → >=TODAY → future
 */
function makeFullPlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    race_date: "2026-10-18",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              { planned: "LLL", start: "2026-05-18", executed: "LLL" },
              { planned: "D", start: "2026-05-25", executed: "D" },
              { planned: "Ta", start: "2026-06-01", executed: "Ta" },
              { planned: "Tb", start: "2026-06-08", executed: "Tb" },
            ],
          },
          {
            weeks: [
              { planned: "L", start: "2026-06-15" },   // 7 — current
              { planned: "LL", start: "2026-06-22" },  // 8 — unsynced_past
              { planned: "LLL", start: "2026-06-29" }, // 9 — unsynced_past
              { planned: "D", start: "2026-07-06" },   // 10 — future
              { planned: "Ta", start: "2026-07-13" },  // 11 — future
              { planned: "Tb", start: "2026-07-20" },  // 12 — future
            ],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-10-04" },  // 13 — future
              { planned: "P", start: "2026-10-11" },  // 14 — future
              { planned: "R", start: "2026-10-18" },  // 15 — future
              { planned: "N", start: "2026-10-25" },  // 16 — future
            ],
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Engine computation tests
// ---------------------------------------------------------------------------

describe("getPlanStatus", () => {
  it("identifies current week as first without executed", () => {
    const plan = makeSingleFractalPlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "LL" },
      { planned: "LLL", start: "2026-05-18" }, // first without executed
      { planned: "D", start: "2026-05-25" },
    ]);
    const status = getPlanStatus(plan, "2026-05-22");
    expect(status.currentWeek?.absoluteIndex).toBe(3);
    expect(status.currentWeek?.planned).toBe("LLL");
    expect(status.currentWeek?.marker).toBe("current");
  });

  it("returns completion state when all weeks have executed", () => {
    const plan = makeSingleFractalPlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "LL" },
    ]);
    const status = getPlanStatus(plan, "2026-06-01");
    expect(status.isComplete).toBe(true);
    expect(status.currentWeek).toBeUndefined();
    expect(status.nextMilestones).toHaveLength(0);
    expect(status.unsyncedPastWeeks).toHaveLength(0);
  });

  it("computes correct week index (N of total)", () => {
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
                { planned: "L", start: "2026-05-04", executed: "L" },
                { planned: "LL", start: "2026-05-11", executed: "LL" },
                { planned: "LLL", start: "2026-05-18", executed: "LLL" },
              ],
            },
            {
              weeks: [
                { planned: "D", start: "2026-05-25" }, // week 4 — current
                { planned: "Ta", start: "2026-06-01" }, // week 5
              ],
            },
          ],
        },
      ],
    });
    const status = getPlanStatus(plan, "2026-05-28");
    expect(status.currentWeek?.absoluteIndex).toBe(4);
    expect(status.currentWeek?.totalWeeks).toBe(5);
    expect(status.totalWeeks).toBe(5);
  });

  it("computes correct mesocycle and fractal position", () => {
    const plan = parsePlan({
      schema_version: 1,
      block: "build",
      start: "2026-05-04",
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            { weeks: [{ planned: "L", start: "2026-05-04", executed: "L" }] },
            { weeks: [{ planned: "LL", start: "2026-05-11" }] }, // current, F2 of 2
          ],
        },
        {
          name: "TAPER",
          fractals: [
            { weeks: [{ planned: "P", start: "2026-05-18" }] },
          ],
        },
      ],
    });
    const status = getPlanStatus(plan, "2026-05-14");
    expect(status.currentWeek?.mesocycleName).toBe("CANAL");
    expect(status.currentWeek?.fractalIndex).toBe(2);
    expect(status.currentWeek?.totalFractals).toBe(2);
  });

  it("marks synced matching weeks as ok", () => {
    const plan = makeSingleFractalPlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "LL" },
      { planned: "LLL", start: "2026-05-18" }, // current
    ]);
    const status = getPlanStatus(plan, "2026-05-22");
    const synced = status.weeks.filter((w) => w.executed !== undefined);
    expect(synced).toHaveLength(2);
    expect(synced.every((w) => w.marker === "ok")).toBe(true);
  });

  it("marks deviated weeks with executed type, planned type, and reason", () => {
    const plan = makeSingleFractalPlan([
      {
        planned: "LLL",
        start: "2026-05-04",
        executed: "INC",
        reason: "illness",
      },
      { planned: "D", start: "2026-05-11" }, // current
    ]);
    const status = getPlanStatus(plan, "2026-05-14");
    const deviated = status.weeks.find((w) => w.marker === "deviated");
    expect(deviated).toBeDefined();
    expect(deviated?.executed).toBe("INC");
    expect(deviated?.planned).toBe("LLL");
    expect(deviated?.reason).toBe("illness");
  });

  it("marks unsynced past weeks as unsynced_past (needs sync)", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const unsyncedPast = status.weeks.filter((w) => w.marker === "unsynced_past");
    // weeks 8 (LL) and 9 (LLL) end before TODAY
    expect(unsyncedPast).toHaveLength(2);
    expect(unsyncedPast[0]?.absoluteIndex).toBe(8);
    expect(unsyncedPast[1]?.absoluteIndex).toBe(9);
    expect(status.unsyncedPastWeeks).toHaveLength(2);
  });

  it("marks future weeks as future (not yet reached)", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    const future = status.weeks.filter((w) => w.marker === "future");
    // weeks 10-16 (D, Ta, Tb in F2 + all of TAPER)
    expect(future).toHaveLength(7);
    expect(future[0]?.absoluteIndex).toBe(10);
    expect(future[0]?.planned).toBe("D");
  });

  it("computes next milestones from current position", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    // current is week 7 (L), so next milestones are week 8 (LL) and week 9 (LLL)
    expect(status.nextMilestones).toHaveLength(2);
    expect(status.nextMilestones[0]?.weekIndex).toBe(8);
    expect(status.nextMilestones[0]?.planned).toBe("LL");
    expect(status.nextMilestones[0]?.weeksFromNow).toBe(1);
    expect(status.nextMilestones[1]?.weekIndex).toBe(9);
    expect(status.nextMilestones[1]?.planned).toBe("LLL");
    expect(status.nextMilestones[1]?.weeksFromNow).toBe(2);
  });

  it("includes date context for current week", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    expect(status.currentWeek?.start).toBe("2026-06-15");
  });

  it("lists unsynced past weeks in default view data", () => {
    const plan = makeFullPlan();
    const status = getPlanStatus(plan, TODAY);
    expect(status.unsyncedPastWeeks).toHaveLength(2);
    expect(status.unsyncedPastWeeks[0]?.planned).toBe("LL");
    expect(status.unsyncedPastWeeks[1]?.planned).toBe("LLL");
  });

  it("handles plan with single mesocycle and single fractal", () => {
    const plan = makeSingleFractalPlan([
      { planned: "L", start: "2026-05-04" },
    ]);
    const status = getPlanStatus(plan, "2026-05-07");
    expect(status.totalWeeks).toBe(1);
    expect(status.currentWeek?.absoluteIndex).toBe(1);
    expect(status.currentWeek?.fractalIndex).toBe(1);
    expect(status.currentWeek?.totalFractals).toBe(1);
    expect(status.isComplete).toBe(false);
  });

  it("handles plan with all weeks synced and some deviated", () => {
    const plan = makeSingleFractalPlan([
      { planned: "L", start: "2026-05-04", executed: "L" },
      { planned: "LL", start: "2026-05-11", executed: "INC", reason: "travel" },
      { planned: "LLL", start: "2026-05-18", executed: "LLL" },
    ]);
    const status = getPlanStatus(plan, "2026-06-01");
    expect(status.isComplete).toBe(true);
    const ok = status.weeks.filter((w) => w.marker === "ok");
    const deviated = status.weeks.filter((w) => w.marker === "deviated");
    expect(ok).toHaveLength(2);
    expect(deviated).toHaveLength(1);
    expect(deviated[0]?.reason).toBe("travel");
  });
});

// ---------------------------------------------------------------------------
// Formatting tests
// ---------------------------------------------------------------------------

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
                { planned: "D", start: "2026-05-11" }, // current
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
    // LL and LLL in F2 are unsynced past
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
