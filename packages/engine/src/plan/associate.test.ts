import { describe, it, expect } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parsePlan } from "./schema.js";
import { associateRun, findPrescribedRun, scanBlockRuns, extractDisplayName } from "./associate.js";

// ---------------------------------------------------------------------------
// Shared test fixture
// ---------------------------------------------------------------------------

/**
 * 10-week plan spanning two mesocycles.
 *
 * CANAL / F1: L(1)  LL(2)  LLL(3)  D(4)  Ta(5)  Tb(6)  — 2026-05-04 to 2026-06-20
 * CANAL / F2: L(7)  LL(8)  LLL(9)                       — 2026-06-15 to 2026-07-05
 * TAPER / F1: P(10)                                       — 2026-07-06 to 2026-07-12
 *
 * Note: weeks in CANAL/F2 immediately follow F1 (no gap).
 */
function makePlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L",   start: "2026-05-04" },
              { planned: "LL",  start: "2026-05-11" },
              { planned: "LLL", start: "2026-05-18" },
              { planned: "D",   start: "2026-05-25" },
              { planned: "Ta",  start: "2026-06-01" },
              { planned: "Tb",  start: "2026-06-08" },
            ],
          },
          {
            weeks: [
              { planned: "L",   start: "2026-06-15" },
              { planned: "LL",  start: "2026-06-22" },
              { planned: "LLL", start: "2026-06-29" },
            ],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-07-06" },
            ],
          },
        ],
      },
    ],
  });
}

function makePlanWithPrescribedRuns() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              {
                planned: "L",
                start: "2026-05-04",
                prescribed_runs: [
                  {
                    local_date: "2026-05-06",
                    label: "Tuesday Intervals",
                    prescription: "3min @ SUB-T[260-280W]",
                    comparison_group: "sub-t-3min",
                  },
                ],
              },
              { planned: "LL", start: "2026-05-11" },
            ],
          },
        ],
      },
    ],
  });
}

function makePlanForAssociationCases() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              {
                planned: "L",
                start: "2026-05-04",
                prescribed_runs: [
                  {
                    local_date: "2026-05-06",
                    label: "Tuesday Intervals A",
                    prescription: "3min @ SUB-T[260-280W]",
                  },
                  {
                    local_date: "2026-05-06",
                    label: "Tuesday Intervals B",
                    prescription: "3min @ SUB-T[260-280W]",
                  },
                  {
                    local_date: "2026-05-08",
                    label: "Friday Tempo",
                    prescription: "20min @ M[251-260W]",
                  },
                ],
              },
              {
                planned: "LL",
                start: "2026-05-11",
                prescribed_runs: [
                  {
                    local_date: "2026-05-13",
                    label: "Wednesday Intervals",
                    prescription: "4min @ SUB-T[260-280W]",
                  },
                  {
                    local_date: "2026-05-14",
                    label: "Wednesday Intervals",
                    prescription: "5min @ SUB-T[260-280W]",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// associateRun
// ---------------------------------------------------------------------------

describe("associateRun", () => {
  it("matches activity date to correct week — happy path", () => {
    const plan = makePlan();
    // 2026-06-20 falls in CANAL/F2 week 7 (L, 2026-06-15 to 2026-06-21)
    const result = associateRun(plan, new Date("2026-06-20T12:00:00Z"), "UTC");

    expect(result).not.toBeNull();
    expect(result!.weekNumber).toBe(7);
    expect(result!.totalWeeks).toBe(10);
    expect(result!.weekType).toBe("L");
    expect(result!.mesocycle).toBe("CANAL");
    expect(result!.fractalIndex).toBe(2);
    expect(result!.totalFractals).toBe(2);
  });

  it("returns null when date is before plan start — outside range", () => {
    const plan = makePlan();
    // 2026-05-03 is the day before the first week starts (2026-05-04)
    const result = associateRun(plan, new Date("2026-05-03T12:00:00Z"), "UTC");
    expect(result).toBeNull();
  });

  it("returns null when date is after last week — outside range", () => {
    const plan = makePlan();
    // 2026-07-13 is after last week ends (2026-07-06 + 7 = 2026-07-13, exclusive)
    const result = associateRun(plan, new Date("2026-07-13T12:00:00Z"), "UTC");
    expect(result).toBeNull();
  });

  it("uses timezone for date conversion — timezone handling", () => {
    const plan = makePlan();

    // 2026-05-04T02:00:00Z = May 4 at 2 AM UTC
    // In America/Santiago (UTC-4 in May), that is still May 3 at 10 PM local
    // so with Santiago timezone the date is "2026-05-03" → before plan → null
    const utcDate = new Date("2026-05-04T02:00:00Z");

    const withSantiago = associateRun(plan, utcDate, "America/Santiago");
    expect(withSantiago).toBeNull(); // local date is May 3, before plan start

    const withUtc = associateRun(plan, utcDate, "UTC");
    expect(withUtc).not.toBeNull(); // local date is May 4, week 1
    expect(withUtc!.weekNumber).toBe(1);
  });

  it("handles week boundary correctly — first day of week", () => {
    const plan = makePlan();
    // 2026-05-11 is exactly the start of week 2 (LL)
    const result = associateRun(plan, new Date("2026-05-11T00:00:00Z"), "UTC");

    expect(result).not.toBeNull();
    expect(result!.weekNumber).toBe(2);
    expect(result!.weekType).toBe("LL");
  });

  it("handles week boundary correctly — last day of week", () => {
    const plan = makePlan();
    // 2026-05-10 is the last day of week 1 (L, starts 2026-05-04, ends before 2026-05-11)
    const result = associateRun(plan, new Date("2026-05-10T23:59:59Z"), "UTC");

    expect(result).not.toBeNull();
    expect(result!.weekNumber).toBe(1);
    expect(result!.weekType).toBe("L");
  });

  it("returns correct fractal and mesocycle for TAPER week", () => {
    const plan = makePlan();
    // 2026-07-08 falls in TAPER/F1 (week 10, P)
    const result = associateRun(plan, new Date("2026-07-08T12:00:00Z"), "UTC");

    expect(result).not.toBeNull();
    expect(result!.weekNumber).toBe(10);
    expect(result!.weekType).toBe("P");
    expect(result!.mesocycle).toBe("TAPER");
    expect(result!.fractalIndex).toBe(1);
    expect(result!.totalFractals).toBe(1);
  });

  it("exposes weekStart for downstream week progress filtering", () => {
    const plan = makePlan();
    const result = associateRun(plan, new Date("2026-06-20T12:00:00Z"), "UTC");

    expect(result).not.toBeNull();
    expect(result!.weekStart).toBe("2026-06-15");
  });
});

describe("findPrescribedRun", () => {
  it("matches one prescribed run by local date in the date-matched week", () => {
    const plan = makePlanWithPrescribedRuns();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-06T12:00:00Z"),
      "UTC",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.match.matchKind).toBe("date");
      expect(result.match.prescribedRun.label).toBe("Tuesday Intervals");
      expect(result.match.prescribedRun.localDate).toBe("2026-05-06");
      expect(result.match.weekContext.absoluteIndex).toBe(1);
    }
  });

  it("returns no_week when run date is outside the plan and no override is supplied", () => {
    const plan = makePlanWithPrescribedRuns();

    const result = findPrescribedRun(
      plan,
      new Date("2026-04-01T12:00:00Z"),
      "UTC",
    );

    expect(result).toEqual({ ok: false, reason: "no_week" });
  });

  it("returns no_prescribed_run when week matches but no prescribed run has the same local date", () => {
    const plan = makePlanWithPrescribedRuns();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-07T12:00:00Z"),
      "UTC",
    );

    expect(result).toEqual({ ok: false, reason: "no_prescribed_run" });
  });

  it("returns ambiguous when multiple prescribed runs share the same local date in the matched week", () => {
    const plan = makePlanForAssociationCases();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-06T12:00:00Z"),
      "UTC",
    );

    expect(result).toEqual({ ok: false, reason: "ambiguous" });
  });

  it("matches by overrideDate across week boundaries", () => {
    const plan = makePlanForAssociationCases();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-14T12:00:00Z"),
      "UTC",
      { overrideDate: "2026-05-08" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.match.matchKind).toBe("override");
      expect(result.match.prescribedRun.label).toBe("Friday Tempo");
      expect(result.match.weekContext.week.start).toBe("2026-05-04");
    }
  });

  it("matches by overrideLabel across week boundaries", () => {
    const plan = makePlanForAssociationCases();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-08T12:00:00Z"),
      "UTC",
      { overrideLabel: "Tuesday Intervals B" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.match.matchKind).toBe("override");
      expect(result.match.prescribedRun.localDate).toBe("2026-05-06");
      expect(result.match.weekContext.week.start).toBe("2026-05-04");
    }
  });

  it("requires overrideDate and overrideLabel to match the same prescribed run", () => {
    const plan = makePlanForAssociationCases();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-08T12:00:00Z"),
      "UTC",
      {
        overrideDate: "2026-05-08",
        overrideLabel: "Tuesday Intervals A",
      },
    );

    expect(result).toEqual({ ok: false, reason: "no_prescribed_run" });
  });

  it("returns ambiguous when override matches multiple prescribed runs", () => {
    const plan = makePlanForAssociationCases();

    const result = findPrescribedRun(
      plan,
      new Date("2026-05-08T12:00:00Z"),
      "UTC",
      { overrideLabel: "Wednesday Intervals" },
    );

    expect(result).toEqual({ ok: false, reason: "ambiguous" });
  });

  it("can match override even when run date falls outside every week", () => {
    const plan = makePlanForAssociationCases();

    const result = findPrescribedRun(
      plan,
      new Date("2027-01-01T12:00:00Z"),
      "UTC",
      { overrideDate: "2026-05-08" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.match.prescribedRun.label).toBe("Friday Tempo");
      expect(result.match.matchKind).toBe("override");
    }
  });
});

// ---------------------------------------------------------------------------
// extractDisplayName
// ---------------------------------------------------------------------------

describe("extractDisplayName", () => {
  it("uses block-number pattern when matched — pattern extraction", () => {
    expect(extractDisplayName("build-10.fit")).toBe("build-10");
    expect(extractDisplayName("run-1.fit")).toBe("run-1");
    expect(extractDisplayName("canal-42.fit")).toBe("canal-42");
  });

  it("uses raw name when pattern not matched — fallback", () => {
    expect(extractDisplayName("track tuesday.fit")).toBe("track tuesday");
    expect(extractDisplayName("morning run.fit")).toBe("morning run");
    expect(extractDisplayName("my-workout.fit")).toBe("my-workout");
  });

  it("is case-insensitive for the .fit extension", () => {
    expect(extractDisplayName("build-10.FIT")).toBe("build-10");
    expect(extractDisplayName("track tuesday.Fit")).toBe("track tuesday");
  });
});

// ---------------------------------------------------------------------------
// scanBlockRuns
// ---------------------------------------------------------------------------

describe("scanBlockRuns", () => {
  it("returns empty array for directory with no .fit files — graceful", async () => {
    const dir = await mkdtemp(join(tmpdir(), "r2m-test-"));
    try {
      // Write a non-.fit file to ensure filtering works
      await writeFile(join(dir, "notes.txt"), "not a fit file");
      const result = await scanBlockRuns(dir);
      expect(result).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("returns empty array for nonexistent directory — graceful", async () => {
    const result = await scanBlockRuns("/does/not/exist/at/all");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty directory — graceful", async () => {
    const dir = await mkdtemp(join(tmpdir(), "r2m-test-"));
    try {
      const result = await scanBlockRuns(dir);
      expect(result).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
