import { defineCommand } from "citty";
import { readFile, writeFile } from "node:fs/promises";
import {
  loadConfig,
  quantify,
  formatResult,
  DEFAULT_PROFILE,
} from "@run2max/engine";
import type { OutputFormat, OutputProfileConfig } from "@run2max/engine";

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

    // ---- Output
    if (args.output) {
      await writeFile(args.output, formatted.output);
      console.error(`Written to ${args.output}`);
    } else {
      process.stdout.write(formatted.output);
    }
  },
});
