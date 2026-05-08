import type { Plan } from "./types.js";
import type { DeviationReport } from "./detect.js";
import { addDays } from "./dates.js";
import { walkPlan } from "./walk.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeekMarker = "ok" | "deviated" | "current" | "unsynced_past" | "future";

export interface WeekStatusEntry {
  absoluteIndex: number;
  totalWeeks: number;
  mesocycleName: string;
  fractalIndex: number;
  totalFractals: number;
  planned: string;
  start: string;
  executed?: string;
  reason?: string;
  marker: WeekMarker;
  /** Populated for unsynced_past weeks when deviation data is supplied. */
  deviationReport?: DeviationReport;
}

export interface PlanStatusOptions {
  /**
   * Pre-computed deviation reports keyed by absolute week index (1-based).
   * When provided, unsynced_past week entries are enriched with the report,
   * and the formatters use `??` instead of `?` for anomalous weeks.
   */
  deviationReports?: Map<number, DeviationReport>;
}

export interface NextMilestone {
  weekIndex: number;
  planned: string;
  weeksFromNow: number;
}

export interface PlanStatus {
  block: string;
  goal?: string;
  raceDate?: string;
  totalWeeks: number;
  isComplete: boolean;
  currentWeek?: WeekStatusEntry;
  nextMilestones: NextMilestone[];
  unsyncedPastWeeks: WeekStatusEntry[];
  weeks: WeekStatusEntry[];
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Computes the status of a training plan.
 *
 * @param plan    Parsed Plan object
 * @param today   ISO date string for "today" (defaults to actual current date).
 *                Pass explicitly to make behaviour deterministic in tests.
 * @param options Optional enrichment — pass `deviationReports` to attach
 *                pre-computed detection results to unsynced past week entries.
 */
export function getPlanStatus(
  plan: Plan,
  today: string = new Date().toISOString().slice(0, 10),
  options?: PlanStatusOptions,
): PlanStatus {
  const raw = walkPlan(plan).map((ctx) => ({
    absoluteIndex: ctx.absoluteIndex,
    mesocycleName: ctx.mesocycleName,
    fractalIndex: ctx.fractalIndex + 1,
    totalFractals: ctx.totalFractals,
    planned: ctx.week.planned,
    start: ctx.week.start,
    executed: ctx.week.executed,
    reason: ctx.week.reason,
  }));

  const totalWeeks = raw.length;
  const isComplete = raw.every((w) => w.executed !== undefined);

  // First week without executed → current position in the plan
  const currentIdx = isComplete ? -1 : raw.findIndex((w) => w.executed === undefined);

  // ------------------------------------------------------------------
  // Assign markers
  // ------------------------------------------------------------------
  const weeks: WeekStatusEntry[] = raw.map((w, i) => {
    let marker: WeekMarker;

    if (w.executed !== undefined) {
      marker = w.executed === w.planned ? "ok" : "deviated";
    } else if (i === currentIdx) {
      marker = "current";
    } else {
      // Week without executed, after current — distinguish past from future
      const weekEnd = addDays(w.start, 7);
      marker = weekEnd < today ? "unsynced_past" : "future";
    }

    const deviationReport =
      marker === "unsynced_past"
        ? options?.deviationReports?.get(w.absoluteIndex)
        : undefined;

    return {
      absoluteIndex: w.absoluteIndex,
      totalWeeks,
      mesocycleName: w.mesocycleName,
      fractalIndex: w.fractalIndex,
      totalFractals: w.totalFractals,
      planned: w.planned,
      start: w.start,
      executed: w.executed,
      reason: w.reason,
      marker,
      deviationReport,
    };
  });

  if (isComplete) {
    return {
      block: plan.block,
      goal: plan.goal,
      raceDate: plan.raceDate,
      totalWeeks,
      isComplete: true,
      nextMilestones: [],
      unsyncedPastWeeks: [],
      weeks,
    };
  }

  const currentWeek = weeks[currentIdx]!;

  // Next 2 milestones after the current week
  const nextMilestones: NextMilestone[] = [];
  for (let i = currentIdx + 1; i < weeks.length && nextMilestones.length < 2; i++) {
    nextMilestones.push({
      weekIndex: weeks[i]!.absoluteIndex,
      planned: weeks[i]!.planned,
      weeksFromNow: i - currentIdx,
    });
  }

  const unsyncedPastWeeks = weeks.filter((w) => w.marker === "unsynced_past");

  return {
    block: plan.block,
    goal: plan.goal,
    raceDate: plan.raceDate,
    totalWeeks,
    isComplete: false,
    currentWeek,
    nextMilestones,
    unsyncedPastWeeks,
    weeks,
  };
}
