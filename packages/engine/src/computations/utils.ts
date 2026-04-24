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
