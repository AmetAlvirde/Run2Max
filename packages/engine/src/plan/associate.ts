import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFitBuffer, normalizeFFP } from "normalize-fit-file";
import type { Plan } from "./schema.js";

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

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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

  // Flatten all weeks from every mesocycle/fractal with structural metadata.
  const flatWeeks: Array<{
    weekNumber: number;
    weekType: string;
    mesocycle: string;
    fractalIndex: number;
    totalFractals: number;
    weekStart: string;
  }> = [];

  let idx = 1;
  for (const meso of plan.mesocycles) {
    const totalFractals = meso.fractals.length;
    let fi = 1;
    for (const fractal of meso.fractals) {
      for (const week of fractal.weeks) {
        flatWeeks.push({
          weekNumber: idx++,
          weekType: week.planned,
          mesocycle: meso.name,
          fractalIndex: fi,
          totalFractals,
          weekStart: week.start,
        });
      }
      fi++;
    }
  }

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
