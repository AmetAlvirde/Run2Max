import type { LapData } from "normalize-fit-file";
import type {
  Run2MaxRecord,
  SegmentRow,
  ZoneConfig,
  DataCapabilities,
} from "../types.js";
import { aggregateBucket } from "./aggregate.js";
import { computeSplitElevation, getAltitude } from "./elevation.js";
import { getDistance } from "./utils.js";

/**
 * Convert a timestamp to epoch ms for comparison.
 */
function toMs(ts: string | Date | number | undefined): number {
  if (ts == null) return 0;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number") return ts;
  return new Date(ts).getTime();
}

/**
 * Group records into laps by time boundaries, then aggregate each lap
 * into a SegmentRow.
 */
export function computeSegments(
  records: Run2MaxRecord[],
  laps: LapData[],
  zones: ZoneConfig[] | undefined,
  capabilities: DataCapabilities,
): SegmentRow[] {
  if (laps.length === 0 || records.length === 0) return [];

  const sortedLaps = [...laps].sort(
    (a, b) => toMs(a.startTime) - toMs(b.startTime),
  );

  // Assign records to lap buckets by time
  const buckets: Run2MaxRecord[][] = sortedLaps.map(() => []);

  for (const record of records) {
    const recordMs = toMs(record.timestamp);
    let assigned = false;

    for (let i = 0; i < sortedLaps.length; i++) {
      const lapStart = toMs(sortedLaps[i].startTime);
      const lapEnd =
        i < sortedLaps.length - 1
          ? toMs(sortedLaps[i + 1].startTime)
          : Infinity;

      if (recordMs >= lapStart && recordMs < lapEnd) {
        buckets[i].push(record);
        assigned = true;
        break;
      }
    }

    // If not assigned (before first lap), put in first bucket
    if (!assigned) buckets[0].push(record);
  }

  return buckets.map((bucket, i) => buildSegmentRow(bucket, i, zones, capabilities));
}

function buildSegmentRow(
  records: Run2MaxRecord[],
  lapIndex: number,
  zones: ZoneConfig[] | undefined,
  capabilities: DataCapabilities,
): SegmentRow {
  const distances = records.map(getDistance);
  const firstDist = distances.find((d) => d != null) ?? 0;
  const lastDist = distances.findLast((d) => d != null) ?? 0;
  const distance = lastDist - firstDist;
  const duration = records.length; // 1 record = 1 time interval
  const aggregated = aggregateBucket(
    records.map((record) => ({ record })),
    { capabilities, zones },
  );

  const avgPace =
    distance > 0 ? duration / (distance / 1000) : null;

  // Elevation
  const hasAltitudeData = records.some((r) => getAltitude(r) !== null);
  const splitElev = hasAltitudeData ? computeSplitElevation(records) : null;
  const elevGain = splitElev?.gain ?? null;
  const elevLoss = splitElev?.loss ?? null;

  // Tier 3: air power
  return {
    lapIndex,
    distance,
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
