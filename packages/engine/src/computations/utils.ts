/**
 * Compute the arithmetic mean of numeric values, skipping null/undefined.
 * Returns null if no valid values exist.
 */
export function avg(values: (number | null | undefined)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    if (v != null) {
      sum += v;
      count++;
    }
  }
  return count === 0 ? null : sum / count;
}

/**
 * Compute the max of rolling window averages over `values`.
 * Nulls within a window are skipped when computing the window average.
 * If windowSize > values.length, falls back to the average of all values.
 * Returns null if no non-null values exist.
 */
export function rollingWindowPeak(
  values: (number | null)[],
  windowSize: number,
): number | null {
  if (values.length === 0) return null;
  const effectiveWindow = Math.min(windowSize, values.length);
  let peak: number | null = null;

  for (let i = 0; i <= values.length - effectiveWindow; i++) {
    const windowAvg = avg(values.slice(i, i + effectiveWindow));
    if (windowAvg !== null && (peak === null || windowAvg > peak)) {
      peak = windowAvg;
    }
  }

  return peak;
}

/**
 * Compute the min of rolling window averages over `values`.
 * Used for pace (sec/km) where lower = faster.
 * Nulls within a window are skipped when computing the window average.
 * If windowSize > values.length, falls back to the average of all values.
 * Returns null if no non-null values exist.
 */
export function rollingWindowMin(
  values: (number | null)[],
  windowSize: number,
): number | null {
  if (values.length === 0) return null;
  const effectiveWindow = Math.min(windowSize, values.length);
  let min: number | null = null;

  for (let i = 0; i <= values.length - effectiveWindow; i++) {
    const windowAvg = avg(values.slice(i, i + effectiveWindow));
    if (windowAvg !== null && (min === null || windowAvg < min)) {
      min = windowAvg;
    }
  }

  return min;
}

/**
 * Convert a timestamp of any supported type to epoch milliseconds.
 */
function toMs(ts: string | Date | number | undefined): number | null {
  if (ts == null) return null;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * Compute the modal (most common) interval in seconds between consecutive
 * record timestamps. Returns null if fewer than 2 records have valid timestamps.
 */
export function computeFileSampleRate(
  records: { timestamp?: string | Date | number }[],
): number | null {
  const intervals: number[] = [];

  for (let i = 1; i < records.length; i++) {
    const prev = toMs(records[i - 1]!.timestamp);
    const curr = toMs(records[i]!.timestamp);
    if (prev !== null && curr !== null) {
      const diffSec = Math.round((curr - prev) / 1000);
      if (diffSec > 0) intervals.push(diffSec);
    }
  }

  if (intervals.length === 0) return null;

  // Count occurrences of each interval
  const counts = new Map<number, number>();
  for (const interval of intervals) {
    counts.set(interval, (counts.get(interval) ?? 0) + 1);
  }

  // Return the most common interval
  let mode: number | null = null;
  let maxCount = 0;
  for (const [interval, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = interval;
    }
  }

  return mode;
}

/**
 * Compute Coggan Normalized Power:
 *   1. Compute 30s rolling average of power (windowSize records)
 *   2. Raise each rolling average to the 4th power
 *   3. Compute the mean of the 4th-power values
 *   4. Take the 4th root
 *
 * Returns null if fewer records than windowSize or no valid power data.
 */
export function computeNormalizedPower(
  powerValues: (number | null)[],
  windowSize: number,
): number | null {
  if (powerValues.length < windowSize) return null;

  const rollingAvgs: number[] = [];
  for (let i = 0; i <= powerValues.length - windowSize; i++) {
    const windowAvg = avg(powerValues.slice(i, i + windowSize));
    if (windowAvg !== null) rollingAvgs.push(windowAvg);
  }

  if (rollingAvgs.length === 0) return null;

  const meanOfFourthPowers =
    rollingAvgs.reduce((sum, v) => sum + v ** 4, 0) / rollingAvgs.length;

  return meanOfFourthPowers ** 0.25;
}
