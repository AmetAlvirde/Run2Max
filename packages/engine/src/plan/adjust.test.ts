import { describe, it, expect } from "vitest";
import { parsePlan } from "./schema.js";
import { validatePlan } from "./validate.js";
import { adjustPlan, AdjustError } from "./adjust.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Base plan: 4 executed weeks in CANAL F1, TAPER F1 [P,P,R,N] as future.
 * race_date = 2026-06-15 → EXACT FIT (availableWeeks=3, weeksBeforeR=3).
 */
function makeBasePlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Test",
    distance: "half-marathon",
    race_date: "2026-06-15",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              {
                planned: "D",
                start: "2026-05-18",
                executed: "INC",
                reason: "illness",
              },
              { planned: "Ta", start: "2026-05-25", executed: "Ta" },
            ],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-06-01" },
              { planned: "P", start: "2026-06-08" },
              { planned: "R", start: "2026-06-15" },
              { planned: "N", start: "2026-06-22" },
            ],
          },
        ],
      },
    ],
  });
}

/**
 * Overflow plan: same structure but race_date = 2026-06-08.
 * Overflow by 1 (weeksBeforeR=3, availableWeeks=2).
 * shorten-taper fixes it (weeksBeforeR=2, exact fit).
 */
function makeOverflowPlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Test",
    distance: "half-marathon",
    race_date: "2026-06-08",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              { planned: "D", start: "2026-05-18", executed: "D" },
              { planned: "Ta", start: "2026-05-25", executed: "Ta" },
            ],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-06-01" },
              { planned: "P", start: "2026-06-08" },
              { planned: "R", start: "2026-06-15" },
              { planned: "N", start: "2026-06-22" },
            ],
          },
        ],
      },
    ],
  });
}

/**
 * Drop-fractal overflow plan:
 * CANAL F1 (executed) + CANAL F2 [L,LL,LLL,D,Ta] (future) + TAPER [P,R,N] (future).
 * race_date = 2026-07-06.
 * availableWeeks=6, weeksBeforeR=7 → overflow by 1.
 * After drop-fractal: CANAL F2 dropped. TAPER fits (underflow). ✓
 */
function makeDropFractalPlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Test",
    distance: "half-marathon",
    race_date: "2026-07-06",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              { planned: "D", start: "2026-05-18", executed: "D" },
              { planned: "Ta", start: "2026-05-25", executed: "Ta" },
            ],
          },
          {
            weeks: [
              { planned: "L", start: "2026-06-01" },
              { planned: "LL", start: "2026-06-08" },
              { planned: "LLL", start: "2026-06-15" },
              { planned: "D", start: "2026-06-22" },
              { planned: "Ta", start: "2026-06-29" },
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
              { planned: "R", start: "2026-07-13" },
              { planned: "N", start: "2026-07-20" },
            ],
          },
        ],
      },
    ],
  });
}

/**
 * Impossible-strategy plan:
 * CANAL F2 [L] (future) + TAPER [P,R,N] (future), race_date = 2026-06-08.
 * availableWeeks=2, weeksBeforeR=3 → overflow by 1.
 * shorten-taper fails (only 1P in TAPER) → error.
 */
function makeImpossibleStrategyPlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    race_date: "2026-06-08",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              { planned: "D", start: "2026-05-18", executed: "D" },
              { planned: "Ta", start: "2026-05-25", executed: "Ta" },
            ],
          },
          {
            weeks: [{ planned: "L", start: "2026-06-01" }],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-06-08" },
              { planned: "R", start: "2026-06-15" },
              { planned: "N", start: "2026-06-22" },
            ],
          },
        ],
      },
    ],
  });
}

/** All weeks executed — no future weeks. */
function makeFullyExecutedPlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    race_date: "2026-06-15",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              { planned: "D", start: "2026-05-18", executed: "D" },
            ],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-05-25", executed: "P" },
              { planned: "R", start: "2026-06-01", executed: "R" },
              { planned: "N", start: "2026-06-08", executed: "N" },
            ],
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("adjustPlan", () => {
  // ── frozen history ────────────────────────────────────────────────────────

  it("preserves all executed weeks unchanged", () => {
    const plan = makeOverflowPlan();
    const result = adjustPlan(plan, { strategy: "shorten-taper" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    const canal = result.plan.mesocycles[0]!;
    const frozenWeeks = canal.fractals[0]!.weeks;

    expect(frozenWeeks[0]!.executed).toBe("L");
    expect(frozenWeeks[0]!.planned).toBe("L");
    expect(frozenWeeks[1]!.executed).toBe("LL");
    expect(frozenWeeks[2]!.executed).toBe("D");
    expect(frozenWeeks[3]!.executed).toBe("Ta");
  });

  // ── strategy application ──────────────────────────────────────────────────

  it("applies shorten-taper to future weeks", () => {
    const plan = makeOverflowPlan();
    const result = adjustPlan(plan, { strategy: "shorten-taper" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    // TAPER should now have 3 weeks: [P, R, N]
    const taper = result.plan.mesocycles.find(m => m.name === "TAPER")!;
    expect(taper).toBeDefined();
    const taperWeeks = taper.fractals[0]!.weeks;
    expect(taperWeeks).toHaveLength(3);
    expect(taperWeeks.map(w => w.planned)).toEqual(["P", "R", "N"]);
  });

  it("applies drop-fractal to future weeks", () => {
    const plan = makeDropFractalPlan();
    const result = adjustPlan(plan, { strategy: "drop-fractal" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    // CANAL should only have F1 (the frozen fractal)
    const canal = result.plan.mesocycles.find(m => m.name === "CANAL")!;
    expect(canal).toBeDefined();
    expect(canal.fractals).toHaveLength(1);
    // F1 stays frozen (4 executed weeks)
    expect(canal.fractals[0]!.weeks).toHaveLength(4);

    // TAPER should still be present
    const taper = result.plan.mesocycles.find(m => m.name === "TAPER")!;
    expect(taper).toBeDefined();
    expect(taper.fractals[0]!.weeks.map(w => w.planned)).toEqual([
      "P",
      "R",
      "N",
    ]);
  });

  // ── race date re-reconciliation ───────────────────────────────────────────

  it("re-reconciles when race date changes", () => {
    // race_date moves 1 week later (06-15 → 06-22): underflow → still fits
    const plan = makeBasePlan();
    const result = adjustPlan(plan, { raceDate: "2026-06-22" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    // Plan should reflect new race date
    expect(result.plan.raceDate).toBe("2026-06-22");

    // R week should be on the new race date
    const rWeek = result.plan.mesocycles
      .flatMap(m => m.fractals.flatMap(f => f.weeks))
      .find(w => w.planned === "R");
    expect(rWeek?.start).toBe("2026-06-22");
  });

  // ── error cases ───────────────────────────────────────────────────────────

  it("errors when no future weeks exist", () => {
    const plan = makeFullyExecutedPlan();
    expect(() => adjustPlan(plan, { strategy: "shorten-taper" })).toThrow(
      AdjustError,
    );

    try {
      adjustPlan(plan, { strategy: "shorten-taper" });
    } catch (err) {
      expect(err).toBeInstanceOf(AdjustError);
      expect((err as AdjustError).code).toBe("NO_FUTURE_WEEKS");
    }
  });

  it("errors when strategy doesn't fit", () => {
    // TAPER has only 1P — shorten-taper returns null → impossible
    const plan = makeImpossibleStrategyPlan();
    expect(() => adjustPlan(plan, { strategy: "shorten-taper" })).toThrow(
      AdjustError,
    );

    try {
      adjustPlan(plan, { strategy: "shorten-taper" });
    } catch (err) {
      expect(err).toBeInstanceOf(AdjustError);
      expect((err as AdjustError).code).toBe("STRATEGY_IMPOSSIBLE");
    }
  });

  // ── informational mode ────────────────────────────────────────────────────

  it("lists available strategies when none specified", () => {
    const plan = makeBasePlan();
    const result = adjustPlan(plan, {});

    expect(result.mode).toBe("info");
    if (result.mode !== "info") throw new Error("expected info mode");

    expect(result.frozenWeeks).toBe(4);
    expect(result.adjustableWeeks).toBe(4);
    expect(result.currentRaceDate).toBe("2026-06-15");
    // availableStrategies is an array (may be empty for exact-fit plan)
    expect(Array.isArray(result.availableStrategies)).toBe(true);
  });

  // ── output validity ───────────────────────────────────────────────────────

  it("adjusted plan passes parsePlan and validatePlan", () => {
    const plan = makeOverflowPlan();
    const result = adjustPlan(plan, { strategy: "shorten-taper" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    // Re-serialize and re-parse to verify round-trip validity
    const p = result.plan;
    const reparsed = parsePlan({
      schema_version: 1,
      block: p.block,
      ...(p.goal !== undefined ? { goal: p.goal } : {}),
      ...(p.distance !== undefined ? { distance: p.distance } : {}),
      ...(p.raceDate !== undefined ? { race_date: p.raceDate } : {}),
      start: p.start,
      mesocycles: p.mesocycles.map(m => ({
        name: m.name,
        fractals: m.fractals.map(f => ({
          weeks: f.weeks.map(w => ({
            planned: w.planned,
            start: w.start,
            ...(w.executed !== undefined ? { executed: w.executed } : {}),
            ...(w.reason !== undefined ? { reason: w.reason } : {}),
            ...(w.note !== undefined ? { note: w.note } : {}),
          })),
        })),
      })),
    });

    const diagnostics = validatePlan(reparsed);
    expect(diagnostics).toHaveLength(0);
  });

  // ── date reassignment ─────────────────────────────────────────────────────

  it("recalculates all future week start dates when race date changes", () => {
    const plan = makeBasePlan();
    const result = adjustPlan(plan, { raceDate: "2026-06-22" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    const allWeeks = result.plan.mesocycles.flatMap(m =>
      m.fractals.flatMap(f => f.weeks),
    );
    const futureWeeks = allWeeks.filter(w => w.executed === undefined);

    // R must be on the new race date
    const rWeek = futureWeeks.find(w => w.planned === "R");
    expect(rWeek?.start).toBe("2026-06-22");

    // All future week dates are Mondays (spaced 7 days apart)
    const futureStarts = futureWeeks.map(w => w.start);
    for (let i = 1; i < futureStarts.length; i++) {
      const prev = new Date(futureStarts[i - 1]! + "T00:00:00Z");
      const curr = new Date(futureStarts[i]! + "T00:00:00Z");
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      expect(diff).toBe(7);
    }
  });

  // ── note preservation ─────────────────────────────────────────────────────

  it("preserves notes on future weeks when structure is unchanged", () => {
    // Add a note to a future P week, then adjust race date (no structural change)
    const plan = parsePlan({
      schema_version: 1,
      block: "build",
      race_date: "2026-06-15",
      start: "2026-05-04",
      mesocycles: [
        {
          name: "CANAL",
          fractals: [
            {
              weeks: [
                { planned: "L", start: "2026-05-04", executed: "L" },
                { planned: "LL", start: "2026-05-11", executed: "LL" },
                { planned: "D", start: "2026-05-18", executed: "D" },
                { planned: "Ta", start: "2026-05-25", executed: "Ta" },
              ],
            },
          ],
        },
        {
          name: "TAPER",
          fractals: [
            {
              weeks: [
                { planned: "P", start: "2026-06-01", note: "key shakeout" },
                { planned: "P", start: "2026-06-08" },
                { planned: "R", start: "2026-06-15" },
                { planned: "N", start: "2026-06-22" },
              ],
            },
          ],
        },
      ],
    });

    // Race date moves 1 week later (same structure: [P, P, R, N])
    const result = adjustPlan(plan, { raceDate: "2026-06-22" });

    if (result.mode !== "plan") throw new Error("expected plan mode");

    const taperWeeks = result.plan.mesocycles.find(m => m.name === "TAPER")!
      .fractals[0]!.weeks;

    // First P week should still have its note
    expect(taperWeeks[0]!.planned).toBe("P");
    expect(taperWeeks[0]!.note).toBe("key shakeout");
  });

  // ── boundary condition ────────────────────────────────────────────────────

  it("current week (first without executed) is adjustable", () => {
    // The first TAPER week is the current week. It should be included in adjustable weeks.
    const plan = makeBasePlan();
    const result = adjustPlan(plan, {});

    if (result.mode !== "info") throw new Error("expected info mode");

    // 4 executed weeks (CANAL F1), 4 adjustable weeks (TAPER F1)
    expect(result.adjustableWeeks).toBe(4);
    // Current week (first TAPER P) is in the adjustable set → adjustableWeeks >= 1
    expect(result.adjustableWeeks).toBeGreaterThanOrEqual(1);
  });
});
