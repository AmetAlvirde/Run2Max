import type { Plan } from "./schema.js";
import type { DeviationReport } from "./detect.js";
import { reportHasAnomalies } from "./detect.js";

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
// Helpers
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
  // ------------------------------------------------------------------
  // Flatten weeks with structural context
  // ------------------------------------------------------------------
  interface RawEntry {
    absoluteIndex: number;
    mesocycleName: string;
    fractalIndex: number;
    totalFractals: number;
    planned: string;
    start: string;
    executed?: string;
    reason?: string;
  }

  const raw: RawEntry[] = [];
  let idx = 1;

  for (const meso of plan.mesocycles) {
    const totalFractals = meso.fractals.length;
    let fi = 1;
    for (const fractal of meso.fractals) {
      for (const week of fractal.weeks) {
        raw.push({
          absoluteIndex: idx++,
          mesocycleName: meso.name,
          fractalIndex: fi,
          totalFractals,
          planned: week.planned,
          start: week.start,
          executed: week.executed,
          reason: week.reason,
        });
      }
      fi++;
    }
  }

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

// ---------------------------------------------------------------------------
// Formatting helpers (shared between default and full views)
// ---------------------------------------------------------------------------

function buildHeader(status: PlanStatus): string {
  let header = status.block.toUpperCase();
  if (status.goal) {
    header += ` — ${status.goal}`;
    if (status.raceDate) {
      header += ` (${status.raceDate})`;
    }
  }
  return header;
}

function relativeLabel(weeksFromNow: number): string {
  return weeksFromNow === 1 ? "next week" : `in ${weeksFromNow} weeks`;
}

/** Token for a week entry in the full structural view. */
function weekToFullToken(w: WeekStatusEntry): string {
  switch (w.marker) {
    case "ok":
      return `${w.planned} ok`;
    case "deviated": {
      const suffix = w.reason ? `/${w.reason}` : "";
      return `${w.executed}[${w.planned}${suffix}]`;
    }
    case "current":
      // No suffix — distinguished by the `^ current` line below
      return w.planned;
    case "unsynced_past": {
      const marker = w.deviationReport && reportHasAnomalies(w.deviationReport) ? "??" : "?";
      return `${w.planned}${marker}`;
    }
    case "future":
      return `${w.planned} .`;
  }
}

// ---------------------------------------------------------------------------
// Default view
// ---------------------------------------------------------------------------

/**
 * Formats the default (current-week-focused) plan status view.
 */
export function formatDefaultView(status: PlanStatus): string {
  const lines: string[] = [];

  lines.push(buildHeader(status));

  if (status.isComplete) {
    lines.push(`Plan complete. All ${status.totalWeeks} weeks executed.`);
    return lines.join("\n");
  }

  const cw = status.currentWeek!;

  lines.push(`Mesocycle: ${cw.mesocycleName} | Fractal ${cw.fractalIndex} of ${cw.totalFractals}`);
  lines.push("");
  lines.push(`Week ${cw.absoluteIndex}/${cw.totalWeeks} — ${cw.planned} (${cw.start})`);

  if (status.nextMilestones.length > 0) {
    const [first, second] = status.nextMilestones;
    if (second) {
      lines.push(
        `  Next: ${first!.planned} (${relativeLabel(first!.weeksFromNow)}) → ${second.planned} in ${second.weeksFromNow} weeks`,
      );
    } else {
      lines.push(`  Next: ${first!.planned} (${relativeLabel(first!.weeksFromNow)})`);
    }
  }

  // Split unsynced past weeks into two groups: anomalous vs clean
  const withAnomalies = status.unsyncedPastWeeks.filter(
    (w) => w.deviationReport && reportHasAnomalies(w.deviationReport),
  );
  const cleanUnsynced = status.unsyncedPastWeeks.filter(
    (w) => !w.deviationReport || !reportHasAnomalies(w.deviationReport),
  );

  if (withAnomalies.length > 0) {
    lines.push("");
    lines.push("Unsynced with anomalies:");
    for (const w of withAnomalies) {
      const r = w.deviationReport!;
      const details: string[] = [];
      details.push(`${r.completedRuns}/${r.expectedRuns} runs`);
      if (r.missingLongRunDay) {
        details.push(`missing long run day (${r.missingLongRunDay})`);
      }
      lines.push(
        `  Week ${w.absoluteIndex}/${w.totalWeeks} — ${w.planned} (${w.start}): ${details.join(", ")}`,
      );
    }
  }

  if (cleanUnsynced.length > 0) {
    lines.push("");
    lines.push("Unsynced:");
    for (const w of cleanUnsynced) {
      lines.push(`  Week ${w.absoluteIndex}/${w.totalWeeks} — ${w.planned} (${w.start})`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Full view
// ---------------------------------------------------------------------------

/**
 * Formats the full structural overview of the plan.
 * Each mesocycle is shown with its fractals; each week has a status marker.
 * The current week is identified with a `^ current` caret on the line below.
 */
export function formatFullView(status: PlanStatus): string {
  const lines: string[] = [];

  lines.push(buildHeader(status));

  // Group weeks into mesocycle → fractal buckets preserving plan order
  interface MesoGroup {
    name: string;
    fractals: WeekStatusEntry[][];
  }
  const mesoGroups: MesoGroup[] = [];

  for (const w of status.weeks) {
    let meso = mesoGroups.find((m) => m.name === w.mesocycleName);
    if (!meso) {
      meso = { name: w.mesocycleName, fractals: [] };
      mesoGroups.push(meso);
    }
    const fi = w.fractalIndex - 1; // 0-based
    while (meso.fractals.length <= fi) meso.fractals.push([]);
    meso.fractals[fi]!.push(w);
  }

  for (const meso of mesoGroups) {
    lines.push("");
    lines.push(meso.name);

    meso.fractals.forEach((fractalWeeks, fi) => {
      const prefix = `  F${fi + 1}: `;
      const tokens = fractalWeeks.map(weekToFullToken);
      lines.push(prefix + tokens.join("  "));

      const currentIdx = fractalWeeks.findIndex((w) => w.marker === "current");
      if (currentIdx >= 0) {
        // Compute character column of the current week token
        let col = prefix.length;
        for (let i = 0; i < currentIdx; i++) {
          col += tokens[i]!.length + 2; // token + 2-space separator
        }
        lines.push(" ".repeat(col) + "^ current");
      }
    });
  }

  return lines.join("\n");
}
