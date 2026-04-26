import { defineCommand } from "citty";
import { join } from "node:path";
import {
  loadPlan,
  loadConfig,
  getPlanStatus,
  formatDefaultView,
  formatFullView,
  scanBlockRuns,
  detectWeekDeviations,
} from "@run2max/engine";
import type { DeviationReport } from "@run2max/engine";

export default defineCommand({
  meta: {
    name: "status",
    description: "Show training plan status (current week focus or --full block overview)",
  },
  args: {
    dir: {
      type: "string",
      description: "Directory containing plan.yaml (defaults to current directory)",
      required: false,
    },
    full: {
      type: "boolean",
      description: "Show full block structural overview",
      default: false,
    },
    config: {
      type: "string",
      description: "Explicit path to config file",
      required: false,
    },
  },

  async run({ args }) {
    const dir = args.dir ?? process.cwd();
    const filePath = join(dir, "plan.yaml");

    let plan;
    try {
      plan = await loadPlan(filePath);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exit(1);
    }

    // ---- Load config for microcycle deviation detection (best-effort)
    let microcycleConfig;
    try {
      const config = await loadConfig({ configPath: args.config });
      microcycleConfig = config?.microcycle;
    } catch {
      // Config load failure is non-fatal for status display
    }

    // ---- Get initial status to find unsynced past weeks
    const initialStatus = getPlanStatus(plan);
    const unsyncedPast = initialStatus.weeks.filter((w) => w.marker === "unsynced_past");

    // ---- Detect deviations for unsynced past weeks (when microcycle config available)
    const deviationReports = new Map<number, DeviationReport>();

    if (microcycleConfig && unsyncedPast.length > 0) {
      // Scan all .fit files in the plan directory once
      const allRuns = await scanBlockRuns(dir);
      const today = new Date().toISOString().slice(0, 10);

      for (const week of unsyncedPast) {
        const weekEnd = addDays(week.start, 7);
        // Only detect for weeks fully in the past
        if (weekEnd >= today) continue;

        const weekRuns = allRuns.filter((r) => {
          const runDate = r.date.toISOString().slice(0, 10);
          return runDate >= week.start && runDate < weekEnd;
        });

        const report = detectWeekDeviations(weekRuns, microcycleConfig, week.planned);
        deviationReports.set(week.absoluteIndex, report);
      }
    }

    // ---- Compute final status with deviation enrichment
    const status = getPlanStatus(plan, undefined, {
      deviationReports: deviationReports.size > 0 ? deviationReports : undefined,
    });

    const output = args.full ? formatFullView(status) : formatDefaultView(status);
    console.log(output);
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
