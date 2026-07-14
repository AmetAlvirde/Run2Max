// Shared metric-delta primitive.
//
// The genuinely reusable kernel behind both Comparable-History Delta and Run
// Comparison: given two raw values, coerce each to a finite number or null and
// classify the pair as a usable delta (`left - right`) or as unavailable with
// the side(s) that were missing. Each concept maps this neutral result onto its
// own field names and reason vocabulary; the arithmetic and missing-value rules
// live here once.

export type MetricMissingSide = "none" | "left" | "right" | "both";

export interface NumericDelta {
  left: number | null;
  right: number | null;
  /** `left - right` when both sides are finite, otherwise null. */
  delta: number | null;
  missing: MetricMissingSide;
}

function toFiniteNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function numericDelta(leftRaw: unknown, rightRaw: unknown): NumericDelta {
  const left = toFiniteNumberOrNull(leftRaw);
  const right = toFiniteNumberOrNull(rightRaw);

  if (left !== null && right !== null) {
    return { left, right, delta: left - right, missing: "none" };
  }

  const missing: MetricMissingSide =
    left === null && right === null
      ? "both"
      : left === null
        ? "left"
        : "right";

  return { left, right, delta: null, missing };
}
