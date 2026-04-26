import { defineCommand } from "citty";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { consola } from "consola";
import {
  loadPlan,
  validatePlan,
  getPlanStatus,
  formatFullView,
  adjustPlan,
  AdjustError,
} from "@run2max/engine";
import type { Plan } from "@run2max/engine";

// ---------------------------------------------------------------------------
// Serialization helpers (mirrors sync.ts)
// ---------------------------------------------------------------------------

function planToYaml(plan: Plan): Record<string, unknown> {
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
  } as Record<string, unknown>;
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
// Preview helpers
// ---------------------------------------------------------------------------

function renderFullView(plan: Plan): string {
  return formatFullView(getPlanStatus(plan));
}

function printBeforeAfter(before: Plan, after: Plan): void {
  consola.log("\nCurrent plan:");
  for (const line of renderFullView(before).split("\n")) {
    consola.log("  " + line);
  }
  consola.log("\nAfter adjustment:");
  for (const line of renderFullView(after).split("\n")) {
    consola.log("  " + line);
  }
  consola.log("");
}

// ---------------------------------------------------------------------------
// CLI command
// ---------------------------------------------------------------------------

export default defineCommand({
  meta: {
    name: "adjust",
    description:
      "Restructure future weeks — re-reconcile when race date changes or apply a compression strategy",
  },
  args: {
    dir: {
      type: "string",
      description: "Directory containing plan.yaml (defaults to current directory)",
      required: false,
    },
    "race-date": {
      type: "string",
      description: "New race date (YYYY-MM-DD) — re-reconciles future weeks",
      required: false,
    },
    strategy: {
      type: "string",
      description:
        "Compression strategy: shorten-taper | reduce-transition | shorten-fractal | reduce-testing | skip-testing | drop-fractal",
      required: false,
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation prompt (useful for scripting)",
      required: false,
      default: false,
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

    const raceDate = args["race-date"] as string | undefined;
    const strategy = args.strategy as string | undefined;
    const skipConfirm = args.yes as boolean;

    // ── Informational mode (no flags) ────────────────────────────────────────

    if (raceDate === undefined && strategy === undefined) {
      let result;
      try {
        result = adjustPlan(plan, {});
      } catch (err) {
        if (err instanceof AdjustError) {
          consola.error(err.message);
        } else {
          consola.error((err as Error).message);
        }
        process.exit(1);
      }

      if (result.mode !== "info") {
        consola.error("unexpected result mode");
        process.exit(1);
      }

      consola.log(renderFullView(plan));
      consola.log("");
      consola.info(
        `${result.frozenWeeks} frozen week(s), ${result.adjustableWeeks} adjustable week(s)`,
      );

      if (result.currentRaceDate) {
        consola.info(`Race date: ${result.currentRaceDate}`);
      }

      if (result.availableStrategies.length > 0) {
        consola.log("\nAvailable adjustments:");
        for (const opt of result.availableStrategies) {
          const warnings =
            opt.warnings.length > 0 ? ` [warning: ${opt.warnings.join("; ")}]` : "";
          consola.log(
            `  --strategy ${opt.strategies.join("+")}  (removes ${opt.weeksRemoved} week(s))${warnings}`,
          );
        }
      } else {
        consola.info("No compression strategies available for this plan.");
      }

      return;
    }

    // ── Strategy / race-date mode ─────────────────────────────────────────────

    let adjustResult;
    try {
      adjustResult = adjustPlan(plan, { strategy, raceDate });
    } catch (err) {
      if (err instanceof AdjustError) {
        consola.error(err.message);
      } else {
        consola.error((err as Error).message);
      }
      process.exit(1);
    }

    if (adjustResult.mode !== "plan") {
      consola.error("unexpected result mode");
      process.exit(1);
    }

    const updatedPlan = adjustResult.plan;

    // Show before/after preview
    printBeforeAfter(plan, updatedPlan);

    // Confirm unless --yes
    if (!skipConfirm) {
      const confirmed = await consola.prompt("Apply these changes?", {
        type: "confirm",
        initial: false,
      });
      if (!confirmed) {
        consola.info("Aborted — no changes written");
        return;
      }
    }

    validateAndReport(updatedPlan);
    await savePlan(filePath, updatedPlan);

    const changeDesc = raceDate
      ? `race date changed to ${raceDate}`
      : `strategy "${strategy}" applied`;
    consola.success(`Plan adjusted: ${changeDesc}`);
  },
});
