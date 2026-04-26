import { describe, it, expect } from "vitest";
import { detectWeekDeviations } from "./detect.js";
import type { MicrocycleConfig } from "../config/schema.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Default microcycle: monday=rest, tuesday=workout, wednesday=recovery,
 * thursday=easy_strides, friday=workout, saturday=rest, sunday=long.
 * Non-rest days: tue, wed, thu, fri, sun = 5 expected runs.
 */
const DEFAULT_MICROCYCLE: MicrocycleConfig = {
  weekStart: "monday",
  default: {
    monday: "rest",
    tuesday: "workout",
    wednesday: "recovery",
    thursday: "easy_strides",
    friday: "workout",
    saturday: "rest",
    sunday: "long",
  },
};

/**
 * Microcycle where NO day is mapped to "long".
 * Non-rest days: tue, wed, thu, fri = 4 expected runs.
 */
const NO_LONG_MICROCYCLE: MicrocycleConfig = {
  weekStart: "monday",
  default: {
    monday: "rest",
    tuesday: "workout",
    wednesday: "recovery",
    thursday: "easy_strides",
    friday: "workout",
    saturday: "rest",
    sunday: "rest",
  },
};

/** Create a run with a given UTC date string (YYYY-MM-DD). */
function runOn(isoDate: string): { date: Date } {
  return { date: new Date(isoDate + "T10:00:00Z") };
}

// Test week: 2026-06-15 (Mon) through 2026-06-21 (Sun)
const MON = runOn("2026-06-15"); // getUTCDay() = 1
const TUE = runOn("2026-06-16"); // getUTCDay() = 2
const WED = runOn("2026-06-17"); // getUTCDay() = 3
const THU = runOn("2026-06-18"); // getUTCDay() = 4
const FRI = runOn("2026-06-19"); // getUTCDay() = 5
const SUN = runOn("2026-06-21"); // getUTCDay() = 0

// ---------------------------------------------------------------------------
// Core detection tests
// ---------------------------------------------------------------------------

describe("detectWeekDeviations", () => {
  it("suggests INC when completed runs at or below threshold", () => {
    // 5 expected, incThreshold=2 → INC when <= 3
    const report = detectWeekDeviations([TUE, WED, THU], DEFAULT_MICROCYCLE, "LLL");
    expect(report.suggestINC).toBe(true);
    expect(report.suggestDNF).toBe(false);
    expect(report.completedRuns).toBe(3);
    expect(report.expectedRuns).toBe(5);
  });

  it("does not suggest INC when completed runs above threshold", () => {
    // 4 runs > (5 - 2 = 3) → no INC
    const report = detectWeekDeviations([TUE, WED, THU, FRI], DEFAULT_MICROCYCLE, "LLL");
    expect(report.suggestINC).toBe(false);
    expect(report.suggestDNF).toBe(false);
  });

  it("suggests DNF when zero runs", () => {
    const report = detectWeekDeviations([], DEFAULT_MICROCYCLE, "LLL");
    expect(report.suggestDNF).toBe(true);
    expect(report.suggestINC).toBe(false);
    expect(report.completedRuns).toBe(0);
  });

  it("uses default incThreshold of 2 when not configured in microcycle", () => {
    // No incThreshold in config → defaults to 2
    const config: MicrocycleConfig = { ...DEFAULT_MICROCYCLE };
    // 3 runs <= (5 - 2 = 3) → INC
    const report = detectWeekDeviations([TUE, WED, THU], config, "LLL");
    expect(report.suggestINC).toBe(true);
    expect(report.incThreshold).toBe(2);
  });

  it("respects custom incThreshold from config", () => {
    // incThreshold=1 → INC when completedRuns <= 5-1 = 4
    const config: MicrocycleConfig = { ...DEFAULT_MICROCYCLE, incThreshold: 1 };
    const report = detectWeekDeviations([TUE, WED, THU, FRI], config, "LLL");
    expect(report.suggestINC).toBe(true);
    expect(report.incThreshold).toBe(1);
  });

  it("flags missing long run when no run on configured long day (sunday)", () => {
    // 4 runs, none on sunday → missingLongRunDay = 'sunday'
    const report = detectWeekDeviations([TUE, WED, THU, FRI], DEFAULT_MICROCYCLE, "LLL");
    expect(report.missingLongRunDay).toBe("sunday");
  });

  it("does not flag missing long run when run exists on long day", () => {
    // Run on sunday → no missing long run
    const report = detectWeekDeviations([TUE, WED, THU, SUN], DEFAULT_MICROCYCLE, "LLL");
    expect(report.missingLongRunDay).toBeUndefined();
  });

  it("skips long run detection when no day mapped to long", () => {
    // NO_LONG_MICROCYCLE has no 'long' day
    const report = detectWeekDeviations([TUE, WED, THU, FRI], NO_LONG_MICROCYCLE, "LLL");
    expect(report.missingLongRunDay).toBeUndefined();
  });

  it("returns empty report when microcycle config is absent", () => {
    const report = detectWeekDeviations([TUE, WED], undefined, "LLL");
    expect(report.suggestINC).toBe(false);
    expect(report.suggestDNF).toBe(false);
    expect(report.missingLongRunDay).toBeUndefined();
    expect(report.expectedRuns).toBe(0);
    expect(report.completedRuns).toBe(2);
  });

  it("returns multiple flags in single report (low run count + missing long run)", () => {
    // 3 runs (below threshold) + none on sunday → both INC and missingLongRunDay
    const report = detectWeekDeviations([TUE, WED, THU], DEFAULT_MICROCYCLE, "LLL");
    expect(report.suggestINC).toBe(true);
    expect(report.missingLongRunDay).toBe("sunday");
  });

  // INC and DNF are mutually exclusive
  it("does not suggest INC when run count is zero (DNF takes precedence)", () => {
    const report = detectWeekDeviations([], DEFAULT_MICROCYCLE, "LLL");
    expect(report.suggestDNF).toBe(true);
    expect(report.suggestINC).toBe(false);
  });

  // Long run on saturday (different day config)
  it("detects long run on saturday when configured as long day", () => {
    const satLongConfig: MicrocycleConfig = {
      weekStart: "monday",
      default: {
        monday: "rest",
        tuesday: "workout",
        wednesday: "recovery",
        thursday: "easy_strides",
        friday: "workout",
        saturday: "long",
        sunday: "rest",
      },
    };
    const SAT = runOn("2026-06-20"); // getUTCDay() = 6
    const report = detectWeekDeviations([TUE, WED, THU, SAT], satLongConfig, "LLL");
    expect(report.missingLongRunDay).toBeUndefined();
  });
});
