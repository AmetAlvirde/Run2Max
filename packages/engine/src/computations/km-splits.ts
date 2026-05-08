import type {
  Run2MaxRecord,
  KmSplitRow,
  ZoneConfig,
  DataCapabilities,
} from "../types.js";
import { aggregateBucket, type WeightedRecord } from "./aggregate.js";
import { computeSplitElevation, getAltitude } from "./elevation.js";
import { getDistance } from "./utils.js";

const KM_IN_METERS = 1000;

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
    const dist = getDistance(records[i]) ?? 0;
    const prevDist = i > 0 ? (getDistance(records[i - 1]) ?? 0) : 0;

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

function buildKmSplitRow(
  bucket: WeightedRecord[],
  km: number,
  zones: ZoneConfig[] | undefined,
  capabilities: DataCapabilities,
): KmSplitRow {
  const totalWeight = bucket.reduce((sum, w) => sum + (w.weight ?? 1), 0);
  const duration = totalWeight; // each full weight = 1 second

  // Distance for this split: sum of weighted distance deltas
  const firstDist = getDistance(bucket[0].record) ?? 0;
  const lastDist = getDistance(bucket[bucket.length - 1].record) ?? 0;
  const distance = lastDist - firstDist || totalWeight * (KM_IN_METERS / duration || 0);

  // For partial splits, use actual distance; for full splits, it should be ~1000m
  const actualDistance = distance > 0 ? distance : totalWeight;

  const aggregated = aggregateBucket(bucket, { capabilities, zones });

  const avgPace =
    actualDistance > 0 ? duration / (actualDistance / 1000) : null;


  // Elevation
  const bucketRecords = bucket.map((w) => w.record);
  const hasAltitudeData = bucketRecords.some((r) => getAltitude(r) !== null);
  const splitElev = hasAltitudeData ? computeSplitElevation(bucketRecords) : null;
  const elevGain = splitElev?.gain ?? null;
  const elevLoss = splitElev?.loss ?? null;

  // Tier 3: air power
  return {
    km,
    distance: actualDistance,
    duration,
    avgPower: aggregated.avgPower,
    zone: aggregated.zone,
    avgPace,
    avgHeartRate: aggregated.avgHeartRate,
    avgCadence: aggregated.avgCadence,
    avgStanceTime: aggregated.avgStanceTime,
    avgStanceTimeBalance: aggregated.avgStanceTimeBalance,
    avgStepLength: aggregated.avgStepLength,
    avgVerticalOscillation: aggregated.avgVerticalOscillation,
    formPowerRatio: aggregated.formPowerRatio,
    verticalRatio: aggregated.verticalRatio,
    elevGain,
    elevLoss,
    avgAirPower: aggregated.avgAirPower,
    windSpeed: null,
    windDirection: null,
    temperature: null,
  };
}
