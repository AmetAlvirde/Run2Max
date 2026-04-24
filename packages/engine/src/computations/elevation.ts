import type { Run2MaxRecord, ElevationProfile } from "../types.js";

/**
 * Extract altitude from a record, preferring enhancedAltitude over altitude.
 * Returns null when neither is available.
 */
export function getAltitude(record: Run2MaxRecord): number | null {
  return record.enhancedAltitude ?? record.altitude ?? null;
}

/**
 * Get accumulated distance from a record, preferring strydDistance.
 */
function getDistance(record: Run2MaxRecord): number | null {
  return (record.strydDistance ?? record.distance) as number | null;
}

/**
 * Compute elevation gain and loss from consecutive record altitude deltas.
 */
function computeElevationDeltas(records: Run2MaxRecord[]): {
  gain: number;
  loss: number;
} {
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < records.length; i++) {
    const prev = getAltitude(records[i - 1]!);
    const curr = getAltitude(records[i]!);
    if (prev === null || curr === null) continue;
    const delta = curr - prev;
    if (delta > 0) gain += delta;
    else if (delta < 0) loss += -delta;
  }

  return { gain, loss };
}

/**
 * Compute the elevation profile for a full run.
 *
 * - Uses session totalAscent/totalDescent when available (device-computed, more accurate).
 * - Falls back to summing record deltas for any missing session value.
 * - Returns null if no altitude data is present in records.
 */
export function computeElevationProfile(
  records: Run2MaxRecord[],
  session: { totalAscent?: number; totalDescent?: number },
): ElevationProfile | null {
  // Build points from records that have altitude data
  const points: [number, number][] = [];
  const altitudes: number[] = [];

  for (const record of records) {
    const alt = getAltitude(record);
    if (alt === null) continue;
    const dist = getDistance(record) ?? 0;
    points.push([dist / 1000, alt]);
    altitudes.push(alt);
  }

  if (points.length === 0) return null;

  const minAltitude = Math.min(...altitudes);
  const maxAltitude = Math.max(...altitudes);

  // Prefer session values; fall back to record deltas for any missing one
  const deltas = computeElevationDeltas(records);
  const totalAscent = session.totalAscent ?? deltas.gain;
  const totalDescent = session.totalDescent ?? deltas.loss;
  const netElevation = totalAscent - totalDescent;

  return {
    totalAscent,
    totalDescent,
    netElevation,
    minAltitude,
    maxAltitude,
    points,
  };
}

/**
 * Compute elevation gain and loss for a subset of records (a km split or segment).
 * Reusable by both km-splits and segments computations.
 */
export function computeSplitElevation(
  records: Run2MaxRecord[],
): { gain: number; loss: number } {
  return computeElevationDeltas(records);
}
