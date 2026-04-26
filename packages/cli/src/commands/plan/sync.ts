import { defineCommand } from "citty";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { consola } from "consola";
import type { SelectPromptOptions } from "consola";
import {
  loadPlan,
  validatePlan,
  getPlanStatus,
  syncWeek,
  SyncError,
  REASON_CATEGORIES,
} from "@run2max/engine";
import type { Plan, TestingPeriod } from "@run2max/engine";
import type { SyncData } from "@run2max/engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a parsed Plan back to a plain object suitable for YAML serialization,
 * using snake_case keys to match the on-disk schema.
 */
function planToYaml(plan: Plan): object {
  return {
    schema_version: plan.schemaVersion,
    block: plan.block,
    ...(plan.goal !== undefined ? { goal: plan.goal } : {}),
    ...(plan.distance !== undefined ? { distance: plan.distance } : {}),
    ...(plan.raceDate !== undefined ? { race_date: plan.raceDate } : {}),
    start: plan.start,
    mesocycles: plan.mesocycles.map((meso) => ({
      name: meso.name,
      fractals: meso.fractals.map((fractal) => ({
        weeks: fractal.weeks.map((week) => ({
          planned: week.planned,
          start: week.start,
          ...(week.executed !== undefined ? { executed: week.executed } : {}),
          ...(week.reason !== undefined ? { reason: week.reason } : {}),
          ...(week.note !== undefined ? { note: week.note } : {}),
          ...(week.testingPeriod !== undefined
            ? {
                testing_period: {
                  ...(week.testingPeriod.cp !== undefined ? { cp: week.testingPeriod.cp } : {}),
                  ...(week.testingPeriod.eFtp !== undefined
                    ? { e_ftp: week.testingPeriod.eFtp }
                    : {}),
                  ...(week.testingPeriod.lthr !== undefined
                    ? { lthr: week.testingPeriod.lthr }
                    : {}),
                  ...(week.testingPeriod.zones !== undefined
                    ? { zones: week.testingPeriod.zones }
                    : {}),
                },
              }
            : {}),
        })),
      })),
    })),
  };
}

async function savePlan(filePath: string, plan: Plan): Promise<void> {
  const raw = planToYaml(plan);
  const yaml = stringifyYaml(raw, { lineWidth: 100 });
  await writeFile(filePath, yaml, "utf-8");
}

function validateAndReport(plan: Plan): boolean {
  const diagnostics = validatePlan(plan);
  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      const loc = d.path ? ` (${d.path})` : "";
      consola.warn(`validation: ${d.message}${loc}`);
    }
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Interactive prompts
// ---------------------------------------------------------------------------

async function promptExecutedType(planned: string): Promise<string> {
  const allTypes = ["L", "LL", "LLL", "D", "Ta", "Tb", "P", "R", "N", "INC", "DNF"];

  // Default index: match planned type
  const defaultIdx = allTypes.indexOf(planned);

  const options: SelectPromptOptions["options"] = allTypes.map((t) => ({ value: t, label: t }));
  const result = await consola.prompt(`Executed type (default: ${planned}):`, {
    type: "select",
    options,
    initial: defaultIdx >= 0 ? String(defaultIdx) : "0",
  });

  return (result as string) ?? planned;
}

async function promptReason(): Promise<string | undefined> {
  const options: SelectPromptOptions["options"] = [...REASON_CATEGORIES].map((r) => ({
    value: r,
    label: r,
  }));

  const result = await consola.prompt("Reason for deviation:", {
    type: "select",
    options,
  });

  return result as string | undefined;
}

async function promptNote(): Promise<string | undefined> {
  const addNote = await consola.prompt("Add a note?", { type: "confirm", initial: false });
  if (!addNote) return undefined;

  const note = await consola.prompt("Note:", { type: "text" });
  return (note as string | undefined) || undefined;
}

async function promptTestingPeriod(): Promise<TestingPeriod> {
  const cpStr = await consola.prompt("CP (critical power, watts):", { type: "text" });
  const eFtpStr = await consola.prompt("eFTP (from Intervals.icu, watts):", { type: "text" });
  const lthrStr = await consola.prompt("LTHR (optional, bpm — press enter to skip):", {
    type: "text",
  });

  const cp = cpStr ? Number(cpStr) : undefined;
  const eFtp = eFtpStr ? Number(eFtpStr) : undefined;
  const lthr = lthrStr ? Number(lthrStr) : undefined;

  const period: TestingPeriod = {};
  if (cp !== undefined && !isNaN(cp)) period.cp = cp;
  if (eFtp !== undefined && !isNaN(eFtp)) period.eFtp = eFtp;
  if (lthr !== undefined && !isNaN(lthr)) period.lthr = lthr;

  return period;
}

async function promptTestRunCompleted(): Promise<boolean> {
  return Boolean(
    await consola.prompt("Was the test run completed?", { type: "confirm", initial: false }),
  );
}

const TEST_WEEK_TYPES = new Set(["Ta", "Tb"]);
const DEVIATION_TYPES = new Set(["INC", "DNF"]);

/**
 * Builds SyncData interactively for a single week, following the prompt flow
 * described in the issue spec.
 */
async function buildSyncDataInteractive(
  planned: string,
  weekLabel: string,
): Promise<SyncData | null> {
  consola.info(weekLabel);

  const executed = await promptExecutedType(planned);
  if (executed === null) return null; // user cancelled

  const syncData: SyncData = { executed };

  // reason: only for INC/DNF
  if (DEVIATION_TYPES.has(executed)) {
    syncData.reason = await promptReason();
    syncData.note = await promptNote();
  } else if (executed !== planned) {
    // different type but not INC/DNF: optional note
    syncData.note = await promptNote();
  } else {
    // matches planned: "Add a note?" confirm
    syncData.note = await promptNote();
  }

  // testing period flow
  if (TEST_WEEK_TYPES.has(planned)) {
    if (executed === "DNF") {
      // skip entirely
    } else if (executed === "INC") {
      const completed = await promptTestRunCompleted();
      syncData.testRunCompleted = completed;
      if (completed) {
        syncData.testingPeriod = await promptTestingPeriod();
      }
    } else {
      syncData.testingPeriod = await promptTestingPeriod();
    }
  }

  return syncData;
}

// ---------------------------------------------------------------------------
// CLI command
// ---------------------------------------------------------------------------

export default defineCommand({
  meta: {
    name: "sync",
    description: "Record week execution status — what actually happened vs what was planned",
  },
  args: {
    dir: {
      type: "string",
      description: "Directory containing plan.yaml (defaults to current directory)",
      required: false,
    },
    week: {
      type: "string",
      description: "Absolute 1-based week number to sync",
      required: false,
    },
    executed: {
      type: "string",
      description: "Executed week type (e.g. D, INC, DNF, Ta)",
      required: false,
    },
    reason: {
      type: "string",
      description: "Deviation reason (only with INC or DNF)",
      required: false,
    },
    note: {
      type: "string",
      description: "Free-text note (available on any week)",
      required: false,
    },
    cp: {
      type: "string",
      description: "Critical power result in watts (test weeks only)",
      required: false,
    },
    eftp: {
      type: "string",
      description: "eFTP from Intervals.icu in watts (test weeks only)",
      required: false,
    },
    lthr: {
      type: "string",
      description: "Lactate threshold heart rate in bpm (optional, test weeks only)",
      required: false,
    },
  },

  async run({ args }) {
    const dir = args.dir ?? process.cwd();
    const filePath = join(dir, "plan.yaml");

    let plan: Plan;
    try {
      plan = await loadPlan(filePath);
    } catch (err) {
      consola.error((err as Error).message);
      process.exit(1);
    }

    const flagOnly = args.executed !== undefined;
    const specificWeek = args.week !== undefined ? Number(args.week) : undefined;

    if (flagOnly) {
      // -----------------------------------------------------------------------
      // Flag-only mode
      // -----------------------------------------------------------------------
      if (specificWeek === undefined) {
        consola.error("--week is required when --executed is provided");
        process.exit(1);
      }

      if (isNaN(specificWeek) || specificWeek < 1) {
        consola.error("--week must be a positive integer");
        process.exit(1);
      }

      const syncData: SyncData = { executed: args.executed! };

      if (args.reason) syncData.reason = args.reason;
      if (args.note) syncData.note = args.note;

      const cp = args.cp ? Number(args.cp) : undefined;
      const eFtp = args.eftp ? Number(args.eftp) : undefined;
      const lthr = args.lthr ? Number(args.lthr) : undefined;

      if (cp !== undefined || eFtp !== undefined || lthr !== undefined) {
        syncData.testingPeriod = {};
        if (cp !== undefined) syncData.testingPeriod.cp = cp;
        if (eFtp !== undefined) syncData.testingPeriod.eFtp = eFtp;
        if (lthr !== undefined) syncData.testingPeriod.lthr = lthr;
      }

      let updated: Plan;
      try {
        updated = syncWeek(plan, specificWeek, syncData);
      } catch (err) {
        if (err instanceof SyncError) {
          consola.error(err.message);
        } else {
          consola.error((err as Error).message);
        }
        process.exit(1);
      }

      validateAndReport(updated);
      await savePlan(filePath, updated);
      consola.success(`Week ${specificWeek} synced as ${args.executed}`);
      return;
    }

    // -------------------------------------------------------------------------
    // Interactive mode
    // -------------------------------------------------------------------------

    if (specificWeek !== undefined) {
      // Interactive for a specific week
      if (isNaN(specificWeek) || specificWeek < 1) {
        consola.error("--week must be a positive integer");
        process.exit(1);
      }

      // Find the week's planned type for context
      const status = getPlanStatus(plan);
      const weekEntry = status.weeks.find((w) => w.absoluteIndex === specificWeek);
      if (!weekEntry) {
        consola.error(`Week ${specificWeek} does not exist in the plan`);
        process.exit(1);
      }

      const label = `Week ${weekEntry.absoluteIndex}/${weekEntry.totalWeeks} — ${weekEntry.planned} (${weekEntry.start})`;
      const syncData = await buildSyncDataInteractive(weekEntry.planned, label);
      if (syncData === null) {
        consola.info("Sync cancelled");
        return;
      }

      let updated: Plan;
      try {
        updated = syncWeek(plan, specificWeek, syncData);
      } catch (err) {
        if (err instanceof SyncError) {
          consola.error(err.message);
        } else {
          consola.error((err as Error).message);
        }
        process.exit(1);
      }

      validateAndReport(updated);
      await savePlan(filePath, updated);
      consola.success(`Week ${specificWeek} synced as ${syncData.executed}`);
      return;
    }

    // Batch interactive: walk all unsynced weeks up to and including the current week
    const status = getPlanStatus(plan);
    const syncableWeeks = status.weeks.filter(
      (w) => w.marker === "current" || w.marker === "unsynced_past",
    );

    if (syncableWeeks.length === 0) {
      consola.info("No weeks to sync — all past weeks are already synced");
      return;
    }

    consola.info(`${syncableWeeks.length} week(s) to sync`);

    // Sort ascending so we process past-unsynced weeks before the current week
    const sorted = [...syncableWeeks].sort((a, b) => a.absoluteIndex - b.absoluteIndex);
    let currentPlan = plan;

    for (const weekEntry of sorted) {
      const label = `Week ${weekEntry.absoluteIndex}/${weekEntry.totalWeeks} — ${weekEntry.planned} (${weekEntry.start})`;
      const syncData = await buildSyncDataInteractive(weekEntry.planned, label);

      if (syncData === null) {
        consola.info("Sync cancelled — completed weeks have been saved");
        return;
      }

      let updated: Plan;
      try {
        updated = syncWeek(currentPlan, weekEntry.absoluteIndex, syncData);
      } catch (err) {
        if (err instanceof SyncError) {
          consola.error(err.message);
        } else {
          consola.error((err as Error).message);
        }
        process.exit(1);
      }

      validateAndReport(updated);
      await savePlan(filePath, updated);
      consola.success(`Week ${weekEntry.absoluteIndex} synced as ${syncData.executed}`);
      currentPlan = updated;
    }

    consola.success("All weeks synced");
  },
});
