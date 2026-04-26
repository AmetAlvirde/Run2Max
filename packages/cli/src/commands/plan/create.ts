import { defineCommand } from "citty";
import { join } from "node:path";
import { writeFile, access } from "node:fs/promises";
import { stringify as stringifyYaml } from "yaml";
import {
  buildPlanFromTemplate,
  loadUserTemplates,
  resolveTemplate,
  BUILTIN_TEMPLATES,
  validatePlan,
  reconcile,
  type Plan,
} from "@run2max/engine";

function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
}

function transformKeysToSnake(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformKeysToSnake);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        camelToSnake(k),
        transformKeysToSnake(v),
      ])
    );
  }
  return value;
}

export default defineCommand({
  meta: {
    name: "create",
    description: "Create a new plan.yaml from a template",
  },
  args: {
    template: {
      type: "string",
      description: "Template name (built-in or user-defined)",
      required: true,
    },
    block: {
      type: "string",
      description: "Training block name",
      required: true,
    },
    start: {
      type: "string",
      description: "Start date (YYYY-MM-DD, must fall on configured week_start day)",
      required: true,
    },
    goal: {
      type: "string",
      description: "Race or goal description",
      required: false,
    },
    distance: {
      type: "string",
      description: "Race distance (5k, 10k, half-marathon, marathon)",
      required: false,
    },
    raceDate: {
      type: "string",
      description: "Race date (YYYY-MM-DD)",
      required: false,
    },
    strategy: {
      type: "string",
      description: "Compression strategy name or number (e.g. shorten-taper, 1, shorten-taper+shorten-fractal)",
      required: false,
    },
    dir: {
      type: "string",
      description: "Output directory (defaults to current directory)",
      required: false,
    },
    force: {
      type: "boolean",
      description: "Overwrite existing plan.yaml",
      default: false,
    },
  },

  async run({ args }) {
    const userTemplatesDir = join(
      process.env["HOME"] ?? process.env["USERPROFILE"] ?? ".",
      ".config",
      "run2max",
      "templates"
    );
    const userTemplates = await loadUserTemplates(userTemplatesDir);
    const resolved = resolveTemplate(args.template, userTemplates);

    if (!resolved) {
      const available = [
        ...userTemplates.map((t) => t.name),
        ...BUILTIN_TEMPLATES.map((t) => t.name),
      ].join(", ");
      console.error(`error: unknown template "${args.template}". Available: ${available}`);
      process.exit(1);
      return;
    }

    let plan: Plan;

    if (args.raceDate) {
      const result = reconcile({
        template: resolved,
        start: args.start,
        raceDate: args.raceDate,
        block: args.block,
        goal: args.goal,
        distance: args.distance,
        strategy: args.strategy,
      });

      if (result.fit === "overflow") {
        process.stderr.write(
          `error: template "${resolved.name}" (${result.templateWeeks} weeks) does not fit in the available window ` +
            `(${result.availableWeeks} weeks from ${args.start} to ${args.raceDate}). ` +
            `Need to remove ${result.templateWeeks - result.availableWeeks} week(s).\n\n`
        );
        process.stderr.write(`compression options:\n`);
        for (let i = 0; i < result.options.length; i++) {
          const opt = result.options[i]!;
          const warnings = opt.warnings.length > 0 ? ` [warning: ${opt.warnings.join("; ")}]` : "";
          process.stderr.write(
            `  ${i + 1}. ${opt.strategies.join("+")} — removes ${opt.weeksRemoved} week(s)${warnings}\n`
          );
        }
        process.stderr.write(
          `\nRe-run with --strategy <name or number> to apply a compression strategy.\n`
        );
        process.exit(1);
        return;
      }

      if (result.fit === "underflow") {
        const gapWeeks = result.availableWeeks - result.templateWeeks;
        process.stderr.write(
          `warning: template "${resolved.name}" is ${gapWeeks} week(s) shorter than the available window. ` +
            `Plan starts ${result.plan!.start} (consider adding a bridge block to fill the gap).\n`
        );
      } else {
        process.stderr.write(
          `Race date aligns with template (${result.templateWeeks} weeks, no adjustments needed)\n`
        );
      }

      plan = result.plan!;
    } else {
      try {
        plan = buildPlanFromTemplate(resolved, {
          block: args.block,
          start: args.start,
          goal: args.goal,
          distance: args.distance,
        });
      } catch (err) {
        console.error(`error: ${(err as Error).message}`);
        process.exit(1);
        return;
      }
    }

    const diagnostics = validatePlan(plan);
    if (diagnostics.length > 0) {
      for (const d of diagnostics) {
        const loc = d.path ? ` (${d.path})` : "";
        console.error(`error: ${d.message}${loc}`);
      }
      process.exit(1);
      return;
    }

    const outDir = args.dir ?? process.cwd();
    const filePath = join(outDir, "plan.yaml");

    if (!args.force) {
      try {
        await access(filePath);
        console.error(`error: ${filePath} already exists. Use --force to overwrite.`);
        process.exit(1);
        return;
      } catch {
        // file does not exist, proceed
      }
    }

    const snakePlan = transformKeysToSnake(plan);
    const yaml = stringifyYaml(snakePlan);
    await writeFile(filePath, yaml, "utf-8");

    const totalWeeks = plan.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks)).length;
    const lastWeek = plan.mesocycles.at(-1)!.fractals.at(-1)!.weeks.at(-1)!;
    const goalLine = plan.goal ? ` — ${plan.goal}` : "";
    process.stderr.write(`created: ${filePath}\n`);
    process.stderr.write(`  block: ${plan.block}${goalLine}\n`);
    process.stderr.write(`  template: ${resolved.name}\n`);
    process.stderr.write(`  weeks: ${totalWeeks} (${plan.start} → ${lastWeek.start})\n`);
  },
});
