import type { Run2MaxRecord, DynamicsSummary, DataCapabilities } from "../types.js";
import { avg } from "./utils.js";

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

  // Tier 2
  const avgStanceTime = capabilities.hasRunningDynamics
    ? avg(records.map((r) => r.stanceTime ?? null))
    : null;
  const avgStanceTimeBalance = capabilities.hasRunningDynamics
    ? avg(records.map((r) => r.stanceTimeBalance ?? null))
    : null;
  const avgStepLength = capabilities.hasRunningDynamics
    ? avg(records.map((r) => r.stepLength ?? null))
    : null;
  const avgVerticalOscillation = capabilities.hasRunningDynamics
    ? avg(records.map((r) => r.verticalOscillation ?? null))
    : null;
  const avgVerticalOscillationBalance = capabilities.hasRunningDynamics
    ? avg(records.map((r) => r.verticalOscillationBalance ?? null))
    : null;

  // Tier 3
  const avgFormPower = capabilities.hasStrydEnhanced
    ? avg(records.map((r) => r.formPower ?? null))
    : null;
  const avgAirPower = capabilities.hasStrydEnhanced
    ? avg(records.map((r) => r.airPower ?? null))
    : null;
  const avgLegSpringStiffness = capabilities.hasStrydEnhanced
    ? avg(records.map((r) => r.legSpringStiffness ?? null))
    : null;
  const avgLegSpringStiffnessBalance = capabilities.hasStrydEnhanced
    ? avg(records.map((r) => r.legSpringStiffnessBalance ?? null))
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
    avgStanceTime,
    avgStanceTimeBalance,
    avgStepLength,
    avgVerticalOscillation,
    avgVerticalOscillationBalance,
    avgFormPower,
    avgAirPower,
    avgLegSpringStiffness,
    avgLegSpringStiffnessBalance,
    avgFormPowerRatio,
    avgVerticalRatio,
  };
}
