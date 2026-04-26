import type { MicrocycleConfig } from "../config/schema.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal run representation: only the activity date is needed for detection. */
export interface WeekRun {
  date: Date;
}

export interface DeviationReport {
  /** INC should be suggested — completed runs are at or below the threshold. */
  suggestINC: boolean;
  /** DNF should be suggested — zero runs recorded for the week. */
  suggestDNF: boolean;
  /**
   * Day name (e.g. "sunday") where the long run was expected but no run was found.
   * Undefined when no day is mapped to "long", or when a run exists on that day.
   */
  missingLongRunDay: string | undefined;
  completedRuns: number;
  /** Non-rest days in microcycle.default. 0 when microcycle config is absent. */
  expectedRuns: number;
  /** Threshold used for INC detection. 0 when microcycle config is absent. */
  incThreshold: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DAY_NAMES = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayName = (typeof DAY_NAMES)[number];

/** Maps day name to UTC day-of-week index (Sunday = 0). */
const DAY_TO_UTC_DOW: Record<DayName, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

// ---------------------------------------------------------------------------
// detectWeekDeviations
// ---------------------------------------------------------------------------

/**
 * Pure function — no I/O. Analyses completed runs against the microcycle
 * configuration to surface potential deviations for an unsynced week.
 *
 * The athlete always makes the final call; this function only detects and
 * informs, never auto-classifies.
 *
 * @param weekRuns       Runs that occurred during the week being evaluated.
 * @param microcycleConfig  Global (or plan-overridden) microcycle config.
 *                          When absent, detection is skipped entirely.
 * @param plannedType    Planned week type (e.g. "LLL"). Reserved for future
 *                       per-type detection rules.
 */
export function detectWeekDeviations(
  weekRuns: WeekRun[],
  microcycleConfig: MicrocycleConfig | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  plannedType: string,
): DeviationReport {
  const completedRuns = weekRuns.length;

  if (!microcycleConfig) {
    return {
      suggestINC: false,
      suggestDNF: false,
      missingLongRunDay: undefined,
      completedRuns,
      expectedRuns: 0,
      incThreshold: 0,
    };
  }

  const days = microcycleConfig.default;
  const expectedRuns = DAY_NAMES.filter((d) => days[d] !== "rest").length;
  const incThreshold = microcycleConfig.incThreshold ?? 2;

  // DNF: zero runs recorded
  const suggestDNF = completedRuns === 0;
  // INC: runs below threshold (mutually exclusive with DNF)
  const suggestINC = !suggestDNF && completedRuns <= expectedRuns - incThreshold;

  // Long run detection: find which day is configured as "long"
  const longDay = DAY_NAMES.find((d) => days[d] === "long");
  let missingLongRunDay: string | undefined;

  if (longDay !== undefined) {
    const longDow = DAY_TO_UTC_DOW[longDay];
    const hasLongRun = weekRuns.some((r) => r.date.getUTCDay() === longDow);
    if (!hasLongRun) {
      missingLongRunDay = longDay;
    }
  }

  return {
    suggestINC,
    suggestDNF,
    missingLongRunDay,
    completedRuns,
    expectedRuns,
    incThreshold,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Returns true when the report contains at least one anomaly worth surfacing. */
export function reportHasAnomalies(report: DeviationReport): boolean {
  return report.suggestINC || report.suggestDNF || report.missingLongRunDay !== undefined;
}
