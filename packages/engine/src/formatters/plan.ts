import type { PlanStatus, WeekStatusEntry } from "../plan/status.js";
import { reportHasAnomalies } from "../plan/detect.js";

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

function weekToFullToken(w: WeekStatusEntry): string {
  switch (w.marker) {
    case "ok":
      return `${w.planned} ok`;
    case "deviated": {
      const suffix = w.reason ? `/${w.reason}` : "";
      return `${w.executed}[${w.planned}${suffix}]`;
    }
    case "current":
      return w.planned;
    case "unsynced_past": {
      const marker = w.deviationReport && reportHasAnomalies(w.deviationReport) ? "??" : "?";
      return `${w.planned}${marker}`;
    }
    case "future":
      return `${w.planned} .`;
  }
}

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

export function formatPlanStatus(
  status: PlanStatus,
  options: { view: "default" | "full" },
): string {
  switch (options.view) {
    case "default":
      return formatDefaultView(status);
    case "full":
      return formatFullView(status);
  }
}

export function formatFullView(status: PlanStatus): string {
  const lines: string[] = [];

  lines.push(buildHeader(status));

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
    const fi = w.fractalIndex - 1;
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
        let col = prefix.length;
        for (let i = 0; i < currentIdx; i++) {
          col += tokens[i]!.length + 2;
        }
        lines.push(" ".repeat(col) + "^ current");
      }
    });
  }

  return lines.join("\n");
}
