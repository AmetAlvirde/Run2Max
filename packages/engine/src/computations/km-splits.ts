import type {
  Run2MaxRecord,
  KmSplitRow,
  ZoneConfig,
  DataCapabilities,
} from "../types.js";
import { avg } from "./utils.js";
import { classifyPowerZone } from "./zones.js";

const KM_IN_METERS = 1000;

/**
 * Get the distance value from a record, preferring strydDistance.
 */
function getDistance(record: Run2MaxRecord): number {
  return ((record.strydDistance ?? record.distance) as number | undefined) ?? 0;
}

/**
 * A weighted sample: a record's metric values contributing a fractional
 * time weight to a km bucket.
 */
interface WeightedRecord {
  record: Run2MaxRecord;
  weight: number; // 0..1, fraction of a full time interval
}

/**
 * Slice records at 1km distance boundaries with interpolation.
 * Uses strydDistance (fallback distance) for boundary detection.
 */
export function computeKmSplits(
  records: Run2MaxRecord[],
  zones: ZoneConfig[] | undefined,
  capabilities: DataCapabilities,
): KmSplitRow[] {
  if (records.length === 0) return [];

  const buckets: WeightedRecord[][] = [[]];
  let currentBoundary = KM_IN_METERS;

  for (let i = 0; i < records.length; i++) {
    const dist = getDistance(records[i]);
    const prevDist = i > 0 ? getDistance(records[i - 1]) : 0;

    if (dist < currentBoundary) {
      // Record is fully within the current km bucket
      buckets[buckets.length - 1].push({ record: records[i], weight: 1 });
    } else {
      // Record crosses one or more km boundaries
      let remainingDist = dist - prevDist;
      let currentPos = prevDist;

      while (currentPos + remainingDist >= currentBoundary) {
        const distToBoundary = currentBoundary - currentPos;
        const fraction =
          remainingDist > 0 ? distToBoundary / (dist - prevDist) : 1;

        // Fraction before boundary goes to current bucket
        if (fraction > 0) {
          buckets[buckets.length - 1].push({
            record: records[i],
            weight: fraction,
          });
        }

        remainingDist -= distToBoundary;
        currentPos = currentBoundary;
        currentBoundary += KM_IN_METERS;

        // Start new bucket
        buckets.push([]);
      }

      // Remaining fraction goes to the new bucket
      if (remainingDist > 0) {
        const fraction = remainingDist / (dist - prevDist);
        buckets[buckets.length - 1].push({
          record: records[i],
          weight: fraction,
        });
      }
    }
  }

  return buckets
    .filter((b) => b.length > 0)
    .map((bucket, i) => buildKmSplitRow(bucket, i + 1, zones, capabilities));
}

function weightedAvg(
  bucket: WeightedRecord[],
  accessor: (r: Run2MaxRecord) => number | null | undefined,
): number | null {
  let sum = 0;
  let totalWeight = 0;

  for (const { record, weight } of bucket) {
    const value = accessor(record);
    if (value != null) {
      sum += value * weight;
      totalWeight += weight;
    }
  }

  return totalWeight === 0 ? null : sum / totalWeight;
}

function buildKmSplitRow(
  bucket: WeightedRecord[],
  km: number,
  zones: ZoneConfig[] | undefined,
  capabilities: DataCapabilities,
): KmSplitRow {
  const totalWeight = bucket.reduce((sum, w) => sum + w.weight, 0);
  const duration = totalWeight; // each full weight = 1 second

  // Distance for this split: sum of weighted distance deltas
  const firstDist = getDistance(bucket[0].record);
  const lastDist = getDistance(bucket[bucket.length - 1].record);
  const distance = lastDist - firstDist || totalWeight * (KM_IN_METERS / duration || 0);

  // For partial splits, use actual distance; for full splits, it should be ~1000m
  const actualDistance = distance > 0 ? distance : totalWeight;

  const avgPower = weightedAvg(bucket, (r) => r.power ?? null);
  const avgHeartRate = weightedAvg(bucket, (r) => r.heartRate ?? null);
  const avgCadence = weightedAvg(bucket, (r) => r.cadence ?? null);

  const avgPace =
    actualDistance > 0 ? duration / (actualDistance / 1000) : null;

  const zone =
    avgPower != null && zones ? classifyPowerZone(avgPower, zones) : null;

  // Tier 2
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

  // Derived: vertical ratio (Tier 2)
  const verticalRatio =
    avgVerticalOscillation != null && avgStepLength != null && avgStepLength > 0
      ? (avgVerticalOscillation / avgStepLength) * 100
      : null;

  // Derived: form power ratio (Tier 3)
  const avgFormPower = capabilities.hasStrydEnhanced
    ? weightedAvg(bucket, (r) => r.formPower ?? null)
    : null;
  const formPowerRatio =
    avgFormPower != null && avgPower != null && avgPower > 0
      ? avgFormPower / avgPower
      : null;

  return {
    km,
    distance: actualDistance,
    duration,
    avgPower,
    zone,
    avgPace,
    avgHeartRate,
    avgCadence,
    avgStanceTime,
    avgStanceTimeBalance,
    avgStepLength,
    avgVerticalOscillation,
    formPowerRatio,
    verticalRatio,
    // New fields — computed in Phase 6
    elevGain: null,
    elevLoss: null,
    avgAirPower: null,
    windSpeed: null,
    windDirection: null,
    temperature: null,
  };
}
