import type {
  Run2MaxRecord,
  DataCapabilities,
  ZoneConfig,
} from "../types.js";
import { classifyPowerZone } from "./zones.js";

export interface WeightedRecord {
  record: Run2MaxRecord;
  weight?: number;
}

export interface AggregationConfig {
  capabilities: DataCapabilities;
  zones?: ZoneConfig[];
}

export interface AggregatedFields {
  avgPower: number | null;
  zone: string | null;
  avgHeartRate: number | null;
  avgCadence: number | null;
  avgStanceTime: number | null;
  avgStanceTimeBalance: number | null;
  avgStepLength: number | null;
  avgVerticalOscillation: number | null;
  avgFormPower: number | null;
  avgAirPower: number | null;
  verticalRatio: number | null;
  formPowerRatio: number | null;
}

function weightedAvg(
  bucket: readonly WeightedRecord[],
  accessor: (record: Run2MaxRecord) => number | null | undefined,
): number | null {
  let sum = 0;
  let totalWeight = 0;

  for (const { record, weight } of bucket) {
    const value = accessor(record);
    if (value == null) continue;
    const effectiveWeight = weight ?? 1;
    sum += value * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  return totalWeight === 0 ? null : sum / totalWeight;
}

export function aggregateBucket(
  bucket: readonly WeightedRecord[],
  config: AggregationConfig,
): AggregatedFields {
  const { capabilities, zones } = config;

  const avgPower = weightedAvg(bucket, (r) => r.power ?? null);
  const avgHeartRate = weightedAvg(bucket, (r) => r.heartRate ?? null);
  const avgCadence = weightedAvg(bucket, (r) => r.cadence ?? null);

  const avgStanceTime = capabilities.hasRunningDynamics
    ? weightedAvg(bucket, (r) => r.stanceTime ?? null)
    : null;
  const avgStanceTimeBalance = capabilities.hasRunningDynamics
    ? weightedAvg(bucket, (r) => r.stanceTimeBalance ?? null)
    : null;
  const avgStepLength = capabilities.hasRunningDynamics
    ? weightedAvg(bucket, (r) => r.stepLength ?? null)
    : null;
  const avgVerticalOscillation = capabilities.hasRunningDynamics
    ? weightedAvg(bucket, (r) => r.verticalOscillation ?? null)
    : null;

  const avgFormPower = capabilities.hasStrydEnhanced
    ? weightedAvg(bucket, (r) => r.formPower ?? null)
    : null;
  const avgAirPower = capabilities.hasStrydEnhanced
    ? weightedAvg(bucket, (r) => r.airPower ?? null)
    : null;

  const zone = avgPower != null && zones ? classifyPowerZone(avgPower, zones) : null;
  const verticalRatio =
    avgVerticalOscillation != null && avgStepLength != null && avgStepLength > 0
      ? (avgVerticalOscillation / avgStepLength) * 100
      : null;
  const formPowerRatio =
    avgFormPower != null && avgPower != null && avgPower > 0
      ? avgFormPower / avgPower
      : null;

  return {
    avgPower,
    zone,
    avgHeartRate,
    avgCadence,
    avgStanceTime,
    avgStanceTimeBalance,
    avgStepLength,
    avgVerticalOscillation,
    avgFormPower,
    avgAirPower,
    verticalRatio,
    formPowerRatio,
  };
}
