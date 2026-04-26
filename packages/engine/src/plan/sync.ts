import type { Plan, TestingPeriod } from "./schema.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface SyncData {
  executed: string;
  reason?: string;
  note?: string;
  testingPeriod?: TestingPeriod;
  /**
   * Only relevant when executed is "INC" on a test week (Ta or Tb).
   * If true, the test run was completed and testingPeriod will be attached.
   * If false or omitted, testingPeriod is skipped.
   */
  testRunCompleted?: boolean;
}

export class SyncError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SyncError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const TEST_WEEK_TYPES = new Set(["Ta", "Tb"]);

interface FlatWeek {
  absoluteIndex: number; // 1-based
  mesoIndex: number;
  fractalIndex: number;
  weekIndex: number;
  executed?: string;
}

function flattenWeeks(plan: Plan): FlatWeek[] {
  const result: FlatWeek[] = [];
  let idx = 1;

  for (let mi = 0; mi < plan.mesocycles.length; mi++) {
    const meso = plan.mesocycles[mi]!;
    for (let fi = 0; fi < meso.fractals.length; fi++) {
      const fractal = meso.fractals[fi]!;
      for (let wi = 0; wi < fractal.weeks.length; wi++) {
        result.push({
          absoluteIndex: idx++,
          mesoIndex: mi,
          fractalIndex: fi,
          weekIndex: wi,
          executed: fractal.weeks[wi]!.executed,
        });
      }
    }
  }

  return result;
}

/**
 * Finds the index (within the fractal's weeks array) of the last consecutive
 * test week (Ta/Tb) starting at or after `startWi`.
 * Returns `startWi` itself if the next week is not a test week.
 */
function findLastTestWeekInSequence(
  fractalWeeks: Plan["mesocycles"][number]["fractals"][number]["weeks"],
  startWi: number,
): number {
  let lastTestWi = startWi;

  for (let i = startWi + 1; i < fractalWeeks.length; i++) {
    if (TEST_WEEK_TYPES.has(fractalWeeks[i]!.planned)) {
      lastTestWi = i;
    } else {
      break;
    }
  }

  return lastTestWi;
}

/**
 * Produces a deep-ish clone of the plan sufficient for immutable updates.
 * Clones the structural path down to a specific week.
 */
function clonePlan(plan: Plan): Plan {
  return {
    ...plan,
    mesocycles: plan.mesocycles.map((meso) => ({
      ...meso,
      fractals: meso.fractals.map((fractal) => ({
        ...fractal,
        weeks: fractal.weeks.map((week) => ({ ...week })),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Records execution data for a specific week in the plan.
 *
 * @param plan       Parsed Plan object (not mutated — a new plan is returned)
 * @param weekIndex  Absolute 1-based week number (matches Week N/total in plan status)
 * @param syncData   Execution data to apply
 * @returns          Updated plan with the week synced
 * @throws SyncError when the week cannot be synced (already synced or future)
 */
export function syncWeek(plan: Plan, weekIndex: number, syncData: SyncData): Plan {
  const flatWeeks = flattenWeeks(plan);

  // Find the frontier: the first unexecuted week (0-based position in flatWeeks)
  const frontierFlatIdx = flatWeeks.findIndex((w) => w.executed === undefined);

  // Locate the target week (0-based in flatWeeks)
  const targetFlatIdx = weekIndex - 1;
  const target = flatWeeks[targetFlatIdx];

  if (!target) {
    throw new SyncError(`week ${weekIndex} does not exist in the plan`, "WEEK_NOT_FOUND");
  }

  // Reject already-synced weeks (executed is frozen)
  if (target.executed !== undefined) {
    throw new SyncError(
      `week ${weekIndex} is already synced and cannot be modified`,
      "ALREADY_SYNCED",
    );
  }

  // Reject future weeks: those that come after the frontier
  // (frontierFlatIdx === -1 means all weeks are synced — any attempt to sync is a no-op)
  if (frontierFlatIdx === -1 || targetFlatIdx > frontierFlatIdx) {
    throw new SyncError(
      `week ${weekIndex} is a future week and cannot be synced ahead of schedule`,
      "FUTURE_WEEK",
    );
  }

  const updated = clonePlan(plan);

  const { mesoIndex, fractalIndex, weekIndex: wi } = target;
  const fractalWeeks = updated.mesocycles[mesoIndex]!.fractals[fractalIndex]!.weeks;
  const week = fractalWeeks[wi]!;

  // Apply execution status and optional fields
  week.executed = syncData.executed;

  if (syncData.reason !== undefined) {
    week.reason = syncData.reason;
  }

  if (syncData.note !== undefined) {
    week.note = syncData.note;
  }

  // Apply testingPeriod only when appropriate
  if (syncData.testingPeriod !== undefined && TEST_WEEK_TYPES.has(week.planned)) {
    const shouldAttach = shouldAttachTestingPeriod(syncData);

    if (shouldAttach) {
      // Attach to the LAST test week in the consecutive sequence (Tb if present, Ta if alone)
      const lastTestWi = findLastTestWeekInSequence(fractalWeeks, wi);
      fractalWeeks[lastTestWi]!.testingPeriod = syncData.testingPeriod;
    }
  }

  return updated;
}

/**
 * Decides whether testingPeriod data should be attached based on execution type
 * and the testRunCompleted flag.
 */
function shouldAttachTestingPeriod(syncData: SyncData): boolean {
  if (syncData.executed === "DNF") return false;

  if (syncData.executed === "INC") {
    return syncData.testRunCompleted === true;
  }

  return true;
}
