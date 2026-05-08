import type { Run2MaxRecord, DynamicsSummary, DataCapabilities } from "../types.js";
import { aggregateBucket } from "./aggregate.js";

/**
 * Compute aggregated running dynamics summary.
 * Returns null if no Tier 2 or Tier 3 data is available.
 */
export function computeDynamicsSummary(
  records: Run2MaxRecord[],
  capabilities: DataCapabilities,
): DynamicsSummary | null {
  if (!capabilities.hasRunningDynamics && !capabilities.hasStrydEnhanced) {
    return null;
  }

  const aggregated = aggregateBucket(
    records.map((record) => ({ record })),
    { capabilities },
  );

  const avgVerticalOscillationBalance = capabilities.hasRunningDynamics
    ? average(records.map((r) => r.verticalOscillationBalance ?? null))
    : null;
  const avgLegSpringStiffness = capabilities.hasStrydEnhanced
    ? average(records.map((r) => r.legSpringStiffness ?? null))
    : null;
  const avgLegSpringStiffnessBalance = capabilities.hasStrydEnhanced
    ? average(records.map((r) => r.legSpringStiffnessBalance ?? null))
    : null;

  // Derived: form power ratio (compute from records where both exist)
  let avgFormPowerRatio: number | null = null;
  if (capabilities.hasStrydEnhanced) {
    const ratios: number[] = [];
    for (const r of records) {
      const fp = r.formPower;
      const p = r.power;
      if (fp != null && p != null && p > 0) {
        ratios.push(fp / p);
      }
    }
    avgFormPowerRatio = ratios.length > 0
      ? ratios.reduce((a, b) => a + b, 0) / ratios.length
      : null;
  }

  // Derived: vertical ratio (compute from records where both exist)
  let avgVerticalRatio: number | null = null;
  if (capabilities.hasRunningDynamics) {
    const ratios: number[] = [];
    for (const r of records) {
      const vo = r.verticalOscillation;
      const sl = r.stepLength;
      if (vo != null && sl != null && sl > 0) {
        ratios.push((vo / sl) * 100);
      }
    }
    avgVerticalRatio = ratios.length > 0
      ? ratios.reduce((a, b) => a + b, 0) / ratios.length
      : null;
  }

  return {
    avgStanceTime: aggregated.avgStanceTime,
    avgStanceTimeBalance: aggregated.avgStanceTimeBalance,
    avgStepLength: aggregated.avgStepLength,
    avgVerticalOscillation: aggregated.avgVerticalOscillation,
    avgVerticalOscillationBalance,
    avgFormPower: aggregated.avgFormPower,
    avgAirPower: aggregated.avgAirPower,
    avgLegSpringStiffness,
    avgLegSpringStiffnessBalance,
    avgFormPowerRatio,
    avgVerticalRatio,
  };
}

function average(values: readonly (number | null)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (value == null) continue;
    sum += value;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}
