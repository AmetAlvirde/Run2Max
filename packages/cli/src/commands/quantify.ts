import { defineCommand } from "citty";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  loadConfig,
  loadPlan,
  quantify,
  formatResult,
  DEFAULT_PROFILE,
  scanBlockRuns,
  detectWeekDeviations,
  reportHasAnomalies,
} from "@run2max/engine";
import type { OutputFormat, OutputProfileConfig, Plan, MicrocycleConfig } from "@run2max/engine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fatal(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export default defineCommand({
  meta: {
    name: "quantify",
    description: "Analyze a .fit file and produce structured run output",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .fit file",
      required: true,
    },
    workout: {
      type: "string",
      alias: "w",
      description: "Workout name (e.g. 'Build 17: Recovery Run')",
    },
    block: {
      type: "string",
      alias: "b",
      description: "Training block (e.g. 'Build Week 04')",
    },
    rpe: {
      type: "string",
      description: "Rating of Perceived Exertion",
    },
    notes: {
      type: "string",
      alias: "n",
      description: "Free-text notes for this run",
    },
    format: {
      type: "string",
      alias: "f",
      default: "md",
      description: "Output format: md (default), json, yaml",
    },
    profile: {
      type: "string",
      alias: "p",
      description: "Output profile name defined in config (e.g. default, detailed)",
    },
    output: {
      type: "string",
      alias: "o",
      description: "Write output to file instead of stdout",
    },
    timezone: {
      type: "string",
      alias: "t",
      description: "IANA timezone override (e.g. America/Santiago)",
    },
    downsample: {
      type: "string",
      alias: "d",
      description: "Downsample interval in seconds (minimum 2)",
    },
    config: {
      type: "string",
      alias: "c",
      description: "Explicit path to config file",
    },
    "exclude-anomalies": {
      type: "boolean",
      default: false,
      description: "Exclude anomalous records from aggregations",
    },
    "no-weather": {
      type: "boolean",
      default: false,
      description: "Skip weather fetch even if config has weather enabled",
    },
    plan: {
      type: "string",
      description:
        "Path to plan.yaml or directory containing plan.yaml. Auto-discovered from the .fit file's directory when absent.",
    },
  },

  async run({ args }) {
    // ---- Validate --format
    const formatMap: Record<string, OutputFormat> = {
      md: "markdown",
      json: "json",
      yaml: "yaml",
    };
    const formatKey = args.format ?? "md";
    if (!(formatKey in formatMap)) {
      fatal(`Invalid format "${formatKey}". Valid options: md, json, yaml`);
    }
    const format: OutputFormat = formatMap[formatKey]!;

    // ---- Validate --timezone
    if (args.timezone) {
      const validTimezones = new Set(Intl.supportedValuesOf("timeZone"));
      if (!validTimezones.has(args.timezone)) {
        fatal(
          `Invalid timezone "${args.timezone}". Use an IANA timezone name (e.g. America/Santiago)`,
        );
      }
    }

    // ---- Validate --downsample
    let downsample: number | undefined;
    if (args.downsample !== undefined) {
      const parsed = Number(args.downsample);
      if (isNaN(parsed) || parsed < 2) {
        fatal(`--downsample must be at least 2 (seconds)`);
      }
      downsample = parsed;
    }

    // ---- Validate --rpe
    let rpe: number | undefined;
    if (args.rpe !== undefined) {
      const parsed = Number(args.rpe);
      if (isNaN(parsed)) {
        fatal(`--rpe must be a number`);
      }
      rpe = parsed;
    }

    // ---- Read .fit file
    let fileBuffer: Buffer;
    try {
      fileBuffer = await readFile(args.file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        fatal(`File not found: ${args.file}`);
      }
      fatal(`Could not read file "${args.file}": ${(err as Error).message}`);
    }
    const fitBuffer = toArrayBuffer(fileBuffer);

    // ---- Load config
    let config;
    try {
      config = await loadConfig({ configPath: args.config });
    } catch (err) {
      fatal((err as Error).message);
    }

    if (config === null) {
      console.error(
        `Warning: No config found at ~/.config/run2max/config.yaml — zone analysis will be unavailable`,
      );
    }

    // ---- Resolve output profile
    let outputProfile: OutputProfileConfig = DEFAULT_PROFILE;
    if (args.profile) {
      const profileName = args.profile as "default" | "detailed" | string;
      const configProfile = config?.output?.[profileName as keyof typeof config.output];
      if (configProfile) {
        outputProfile = configProfile;
      } else {
        console.error(
          `Warning: Profile "${args.profile}" not found in config — using default profile`,
        );
      }
    } else if (config?.output?.default) {
      outputProfile = config.output.default;
    }

    // ---- Resolve timezone
    const timezone = args.timezone ?? config?.athlete?.timezone;

    // ---- Discover and load plan.yaml (silent when absent)
    const fitDir = resolve(dirname(args.file));
    let plan: Plan | undefined;
    if (args.plan) {
      // --plan can be a file path or a directory path
      const planArg = resolve(args.plan);
      let planPath: string;
      try {
        const s = await stat(planArg);
        planPath = s.isDirectory() ? join(planArg, "plan.yaml") : planArg;
      } catch {
        fatal(`Cannot access --plan path "${args.plan}"`);
      }
      try {
        plan = await loadPlan(planPath!);
      } catch (err) {
        fatal(`Could not load plan: ${(err as Error).message}`);
      }
    } else {
      // Auto-discover plan.yaml in the same directory as the .fit file
      const autoPlanPath = join(fitDir, "plan.yaml");
      try {
        plan = await loadPlan(autoPlanPath);
      } catch {
        // Silent — no plan.yaml present
      }
    }

    // ---- Run analysis
    let result;
    try {
      result = await quantify(fitBuffer, {
        config: config ?? undefined,
        workout: args.workout,
        block: args.block,
        rpe,
        notes: args.notes,
        timezone,
        downsample,
        excludeAnomalies: args["exclude-anomalies"],
        noWeather: args["no-weather"],
        plan,
        fitDirPath: fitDir,
      });
    } catch (err) {
      fatal(
        `Could not parse "${args.file}" — expected a valid .fit file: ${(err as Error).message}`,
      );
    }

    // ---- Format output
    const formatted = formatResult(result, format, outputProfile);

    // ---- Print warnings
    for (const warning of formatted.warnings) {
      console.error(`Warning: ${warning}`);
    }

    // ---- Warn about unsynced previous week (cross-week nudge)
    if (plan && result.planContext) {
      await warnIfPreviousWeekUnsynced(plan, result.planContext.weekNumber, fitDir, config?.microcycle);
    }

    // ---- Output
    if (args.output) {
      await writeFile(args.output, formatted.output);
      console.error(`Written to ${args.output}`);
    } else {
      process.stdout.write(formatted.output);
    }
  },
});

// ---------------------------------------------------------------------------
// Previous-week unsynced warning
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Using a structural subtype instead of the full `Plan` type avoids TS2589
// ("Type instantiation is excessively deep and possibly infinite"). `Plan` is
// derived via `v.InferOutput<typeof PlanSchema>`, a valibot conditional type
// that the compiler must expand on every new instantiation context. When
// combined with other valibot-inferred types in the same file the cumulative
// expansion depth exceeds TypeScript's hard limit. Declaring only the fields
// this function actually reads sidesteps the expansion entirely — TypeScript
// performs a trivial structural compatibility check instead.
//
// Long-term refactor: resolve `Plan` (and sibling types) to plain named
// interfaces in packages/engine/src/plan/schema.ts rather than using
// `v.InferOutput<...>` as the public type. That breaks the conditional-type
// chain at the source and removes the problem for all consumers.
type PlanLike = {
  mesocycles: Array<{
    fractals: Array<{
      weeks: Array<{ start: string; planned: string; executed?: string }>;
    }>;
  }>;
};

async function warnIfPreviousWeekUnsynced(
  plan: PlanLike,
  currentWeekNumber: number,
  fitDir: string,
  microcycleConfig: MicrocycleConfig | undefined,
): Promise<void> {
  if (currentWeekNumber <= 1) return;

  const prevWeekNumber = currentWeekNumber - 1;

  // Flatten plan weeks
  const flatWeeks: Array<{
    absoluteIndex: number;
    totalWeeks: number;
    start: string;
    planned: string;
    executed?: string;
  }> = [];

  let idx = 1;
  for (const meso of plan.mesocycles) {
    for (const fractal of meso.fractals) {
      for (const week of fractal.weeks) {
        flatWeeks.push({
          absoluteIndex: idx++,
          totalWeeks: 0,
          start: week.start,
          planned: week.planned,
          executed: week.executed,
        });
      }
    }
  }
  const totalWeeks = flatWeeks.length;
  for (const w of flatWeeks) w.totalWeeks = totalWeeks;

  const prevWeek = flatWeeks.find((w) => w.absoluteIndex === prevWeekNumber);
  if (!prevWeek || prevWeek.executed !== undefined) return;

  // Check the week is fully in the past
  const prevWeekEnd = addDays(prevWeek.start, 7);
  const today = new Date().toISOString().slice(0, 10);
  if (prevWeekEnd >= today) return;

  // Run detection when microcycle config is available
  let anomalyDetails = "";
  if (microcycleConfig) {
    const allRuns = await scanBlockRuns(fitDir);
    const weekRuns = allRuns.filter((r) => {
      const runDate = r.date.toISOString().slice(0, 10);
      return runDate >= prevWeek.start && runDate < prevWeekEnd;
    });

    const report = detectWeekDeviations(weekRuns, microcycleConfig, prevWeek.planned);
    if (reportHasAnomalies(report)) {
      const parts: string[] = [];
      parts.push(`${report.completedRuns}/${report.expectedRuns} runs`);
      if (report.missingLongRunDay) {
        parts.push(`missing long run day (${report.missingLongRunDay})`);
      }
      anomalyDetails = ` (${parts.join(", ")})`;
    }
  }

  console.error(
    `Warning: Week ${prevWeek.absoluteIndex}/${totalWeeks} (${prevWeek.planned}) is unsynced${anomalyDetails}. Run run2max plan sync --week ${prevWeek.absoluteIndex} to record execution.`,
  );
}
