import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import * as v from "valibot";
import { parse as parseYaml } from "yaml";
import { parseConfig, type Run2MaxConfig } from "./schema.js";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function readYaml(filePath: string): Promise<unknown | null> {
  try {
    const contents = await readFile(filePath, "utf-8");
    return parseYaml(contents);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error(`Failed to read config at ${filePath}: ${(err as Error).message}`);
  }
}

function formatValiError(err: v.ValiError<typeof import("./schema.js").Run2MaxConfigSchema>, filePath: string): string {
  const issues = err.issues
    .map((issue) => {
      const path = issue.path?.map((p) => p.key).join(".") ?? "(root)";
      return `  ${path}: ${issue.message}`;
    })
    .join("\n");
  return `Invalid config at ${filePath}:\n${issues}`;
}

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      !Array.isArray(value) &&
      value !== null &&
      typeof value === "object" &&
      typeof result[key] === "object" &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
    } else {
      result[key] = value; // arrays and primitives: override wins
    }
  }
  return result;
}

function parseOrThrow(raw: unknown, filePath: string): Run2MaxConfig {
  try {
    return parseConfig(raw);
  } catch (err) {
    if (err instanceof v.ValiError) {
      throw new Error(formatValiError(err as v.ValiError<typeof import("./schema.js").Run2MaxConfigSchema>, filePath));
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LoadConfigOptions {
  /** Explicit config file path — skips auto-discovery when provided. */
  configPath?: string;
  /** Override CWD for project-level config discovery (used in tests). */
  cwd?: string;
  /** Override user-level config path — defaults to ~/.config/run2max/config.yaml (used in tests). */
  userConfigPath?: string;
}

/**
 * Load and resolve the run2max config.
 *
 * Resolution order (highest priority last):
 *   ~/.config/run2max/config.yaml  (user-level)
 *   ./run2max.config.yaml          (project-level, relative to cwd)
 *   options.configPath             (explicit — bypasses auto-discovery entirely)
 *
 * Returns null when no config file is found anywhere.
 */
export async function loadConfig(
  options?: LoadConfigOptions
): Promise<Run2MaxConfig | null> {
  // Explicit path — bypass auto-discovery entirely
  if (options?.configPath) {
    const raw = await readYaml(options.configPath);
    if (raw === null) {
      throw new Error(`Config file not found: ${options.configPath}`);
    }
    return parseOrThrow(raw, options.configPath);
  }

  const cwd = options?.cwd ?? process.cwd();
  const userConfigPath = options?.userConfigPath ?? join(homedir(), ".config", "run2max", "config.yaml");
  const projectConfigPath = join(cwd, "run2max.config.yaml");

  const [userRaw, projectRaw] = await Promise.all([
    readYaml(userConfigPath),
    readYaml(projectConfigPath),
  ]);

  if (userRaw === null && projectRaw === null) return null;

  if (userRaw !== null && projectRaw === null) {
    return parseOrThrow(userRaw, userConfigPath);
  }

  if (userRaw === null && projectRaw !== null) {
    return parseOrThrow(projectRaw, projectConfigPath);
  }

  // Both found — merge, then validate the combined result
  const merged = deepMerge(
    userRaw as Record<string, unknown>,
    projectRaw as Record<string, unknown>
  );
  return parseOrThrow(merged, `${userConfigPath} + ${projectConfigPath}`);
}
