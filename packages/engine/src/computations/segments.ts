import type { LapData } from "normalize-fit-file";
import type {
  Run2MaxRecord,
  SegmentRow,
  ZoneConfig,
  DataCapabilities,
} from "../types.js";
import { avg } from "./utils.js";
import { classifyPowerZone } from "./zones.js";
import { computeSplitElevation, getAltitude } from "./elevation.js";

/**
 * Get the distance value from a record, preferring strydDistance.
 */
function getDistance(record: Run2MaxRecord): number | null {
  return (record.strydDistance ?? record.distance) as number | null;
}

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

  const avgPower = avg(records.map((r) => r.power ?? null));
  const avgHeartRate = avg(records.map((r) => r.heartRate ?? null));
  const avgCadence = avg(records.map((r) => r.cadence ?? null));

  const avgPace =
    distance > 0 ? duration / (distance / 1000) : null;

  const zone =
    avgPower != null && zones ? classifyPowerZone(avgPower, zones) : null;

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

  // Derived: vertical ratio (Tier 2)
  const verticalRatio =
    avgVerticalOscillation != null && avgStepLength != null && avgStepLength > 0
      ? (avgVerticalOscillation / avgStepLength) * 100
      : null;

  // Derived: form power ratio (Tier 3)
  const avgFormPower = capabilities.hasStrydEnhanced
    ? avg(records.map((r) => r.formPower ?? null))
    : null;
  const formPowerRatio =
    avgFormPower != null && avgPower != null && avgPower > 0
      ? avgFormPower / avgPower
      : null;

  // Elevation
  const hasAltitudeData = records.some((r) => getAltitude(r) !== null);
  const splitElev = hasAltitudeData ? computeSplitElevation(records) : null;
  const elevGain = splitElev?.gain ?? null;
  const elevLoss = splitElev?.loss ?? null;

  // Tier 3: air power
  const avgAirPower = capabilities.hasStrydEnhanced
    ? avg(records.map((r) => r.airPower ?? null))
    : null;

  return {
    lapIndex,
    distance,
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
    elevGain,
    elevLoss,
    avgAirPower,
    windSpeed: null,
    windDirection: null,
    temperature: null,
  };
}
