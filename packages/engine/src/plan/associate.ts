import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFitBuffer, normalizeFFP } from "normalize-fit-file";
import type { Plan } from "./types.js";
import { addDays } from "./dates.js";
import { walkPlan, type WeekContext } from "./walk.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeekAssociation {
  weekNumber: number;
  totalWeeks: number;
  weekType: string;
  mesocycle: string;
  fractalIndex: number;
  totalFractals: number;
  /** ISO date of the week's Monday (or configured week start). */
  weekStart: string;
}

export interface BlockRun {
  path: string;
  displayName: string;
  date: Date;
}

export interface FindPrescribedRunOptions {
  overrideDate?: string;
  overrideLabel?: string;
}

export type FindPrescribedRunReason =
  | "no_week"
  | "no_prescribed_run"
  | "ambiguous";

export interface PrescribedRunMatch {
  prescribedRun: NonNullable<WeekContext["week"]["prescribedRuns"]>[number];
  weekContext: WeekContext;
  matchKind: "date" | "override";
}

export type FindPrescribedRunResult =
  | { ok: true; match: PrescribedRunMatch }
  | { ok: false; reason: FindPrescribedRunReason };

export class PrescribedRunOverrideError extends Error {
  constructor(
    public readonly reason: FindPrescribedRunReason,
    public readonly override: FindPrescribedRunOptions,
  ) {
    super(`Prescribed run override failed: ${reason}`);
    this.name = "PrescribedRunOverrideError";
  }
}

/**
 * Converts a UTC Date to a local ISO date string (YYYY-MM-DD) in the given
 * timezone. Uses the "en-CA" locale which produces ISO 8601 date format.
 */
function toLocalDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// ---------------------------------------------------------------------------
// extractDisplayName
// ---------------------------------------------------------------------------

/**
 * Returns the display name for a .fit file: strips the `.fit` extension.
 * Both `build-10.fit` → `build-10` and `track tuesday.fit` → `track tuesday`.
 */
export function extractDisplayName(fileName: string): string {
  return fileName.replace(/\.fit$/i, "");
}

// ---------------------------------------------------------------------------
// associateRun
// ---------------------------------------------------------------------------

/**
 * Finds the week in the plan that contains the given activity date.
 *
 * The activityDate is converted to a local date string using the supplied
 * timezone before comparison. Returns null when the date falls outside every
 * week range in the plan.
 */
export function associateRun(
  plan: Plan,
  activityDate: Date,
  timezone: string,
): WeekAssociation | null {
  const localDate = toLocalDate(activityDate, timezone);

  const flatWeeks = walkPlan(plan).map((ctx) => ({
    weekNumber: ctx.absoluteIndex,
    weekType: ctx.week.planned,
    mesocycle: ctx.mesocycleName,
    fractalIndex: ctx.fractalIndex + 1,
    totalFractals: ctx.totalFractals,
    weekStart: ctx.week.start,
  }));

  const totalWeeks = flatWeeks.length;

  for (const w of flatWeeks) {
    const weekEnd = addDays(w.weekStart, 7);
    if (localDate >= w.weekStart && localDate < weekEnd) {
      return {
        weekNumber: w.weekNumber,
        totalWeeks,
        weekType: w.weekType,
        mesocycle: w.mesocycle,
        fractalIndex: w.fractalIndex,
        totalFractals: w.totalFractals,
        weekStart: w.weekStart,
      };
    }
  }

  return null;
}

export function findPrescribedRun(
  plan: Plan,
  runDate: Date,
  timezone: string,
  options?: FindPrescribedRunOptions,
): FindPrescribedRunResult {
  const localDate = toLocalDate(runDate, timezone);
  const flatWeeks = walkPlan(plan);

  const hasOverride = Boolean(options?.overrideDate || options?.overrideLabel);

  if (hasOverride) {
    const matches: PrescribedRunMatch[] = [];

    for (const weekContext of flatWeeks) {
      const runs = weekContext.week.prescribedRuns ?? [];
      for (const prescribedRun of runs) {
        if (options?.overrideDate && prescribedRun.localDate !== options.overrideDate) {
          continue;
        }
        if (options?.overrideLabel && prescribedRun.label !== options.overrideLabel) {
          continue;
        }
        matches.push({ prescribedRun, weekContext, matchKind: "override" });
      }
    }

    if (matches.length === 1) {
      return { ok: true, match: matches[0]! };
    }
    if (matches.length > 1) {
      return { ok: false, reason: "ambiguous" };
    }
    return { ok: false, reason: "no_prescribed_run" };
  }

  const weekContext = flatWeeks.find((ctx) => {
    const weekEnd = addDays(ctx.week.start, 7);
    return localDate >= ctx.week.start && localDate < weekEnd;
  });

  if (!weekContext) {
    return { ok: false, reason: "no_week" };
  }

  const matches = (weekContext.week.prescribedRuns ?? []).filter(
    (run) => run.localDate === localDate,
  );

  if (matches.length === 1) {
    return {
      ok: true,
      match: {
        prescribedRun: matches[0]!,
        weekContext,
        matchKind: "date",
      },
    };
  }

  if (matches.length > 1) {
    return { ok: false, reason: "ambiguous" };
  }

  return { ok: false, reason: "no_prescribed_run" };
}

// ---------------------------------------------------------------------------
// scanBlockRuns
// ---------------------------------------------------------------------------

function nodeBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

/**
 * Reads all `.fit` files in `dirPath` and returns their activity timestamps
 * and display names, sorted by date ascending.
 *
 * Files that cannot be parsed are silently skipped. Returns an empty array
 * when the directory does not exist or contains no `.fit` files.
 *
 * Note: Uses parseFitBuffer to extract the session timestamp. Only the header
 * and session record are needed, but the full parse is used for robustness
 * with the existing normalize-fit-file library.
 */
export async function scanBlockRuns(dirPath: string): Promise<BlockRun[]> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch {
    return [];
  }

  const fitFiles = entries.filter((f) => /\.fit$/i.test(f));
  const results: BlockRun[] = [];

  for (const fileName of fitFiles) {
    const filePath = join(dirPath, fileName);
    try {
      const buf = await readFile(filePath);
      const arrayBuf = nodeBufferToArrayBuffer(buf);
      const rawData = await parseFitBuffer(arrayBuf);
      const normalized = normalizeFFP(rawData);

      const rawDate =
        normalized.metadata.startTime ?? normalized.metadata.timestamp;
      if (!rawDate) continue;

      const date = rawDate instanceof Date ? rawDate : new Date(rawDate);

      results.push({
        path: filePath,
        displayName: extractDisplayName(fileName),
        date,
      });
    } catch {
      // Skip files that cannot be parsed
    }
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());
  return results;
}
