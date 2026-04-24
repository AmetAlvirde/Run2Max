import type { SessionSummary, WorkoutMetadata } from "normalize-fit-file";
import type {
  Run2MaxRecord,
  RunSummary,
  QuantifyOptions,
  Run2MaxConfig,
} from "../types.js";
import { avg, rollingWindowPeak, rollingWindowMin, computeNormalizedPower } from "./utils.js";
import { classifyPowerZone, classifyZone } from "./zones.js";
import { computeElevationProfile } from "./elevation.js";

/**
 * Get the distance value from a record, preferring strydDistance.
 */
function getDistance(record: Run2MaxRecord): number | null {
  return (record.strydDistance ?? record.distance) as number | null;
}

/**
 * Resolve LTHR from config: thresholds.lthr → calibration.lthr → null.
 */
function resolveLthr(config: Run2MaxConfig | undefined): number | null {
  return config?.thresholds?.lthr ?? config?.calibration?.lthr ?? null;
}

/**
 * Build the RunSummary from session data, records, and options.
 */
export function computeSummary(
  records: Run2MaxRecord[],
  session: SessionSummary,
  metadata: WorkoutMetadata,
  config: Run2MaxConfig | undefined,
  options: QuantifyOptions,
): RunSummary {
  // Date — prefer metadata.startTime (explicitly typed) over session
  const rawDate = metadata.startTime ?? metadata.timestamp;
  const date = rawDate instanceof Date
    ? rawDate
    : rawDate != null
      ? new Date(rawDate)
      : new Date();

  // Timezone
  const timezone = options.timezone ?? config?.athlete?.timezone ?? "UTC";

  // Duration and moving time from session
  const duration = session.totalElapsedTime ?? 0;
  const movingTime = session.totalTimerTime ?? 0;

  // Distance from last record's strydDistance (fallback distance)
  const lastRecordDist = records.length > 0
    ? getDistance(records[records.length - 1])
    : null;
  const distance = lastRecordDist ?? session.totalDistance ?? 0;

  // Averages from records
  const avgPower = avg(records.map((r) => r.power ?? null));
  const avgHeartRate = avg(records.map((r) => r.heartRate ?? null));

  // Zone classification
  const avgPowerZone =
    avgPower != null && config?.powerZones
      ? classifyPowerZone(avgPower, config.powerZones)
      : null;

  // HR as % of LTHR
  const lthr = resolveLthr(config);
  const avgHeartRatePctLthr =
    avgHeartRate != null && lthr != null
      ? (avgHeartRate / lthr) * 100
      : null;

  // Pace from moving time and distance
  const avgPace =
    distance > 0 && movingTime > 0
      ? movingTime / (distance / 1000)
      : null;

  // Max values
  const hrValues = records.map((r) => r.heartRate ?? null).filter((v): v is number => v !== null);
  const maxHeartRate = hrValues.length > 0 ? Math.max(...hrValues) : null;
  const maxPower = rollingWindowPeak(records.map((r) => r.power ?? null), 5);
  const paceValues = records.map((r) =>
    r.speed != null && r.speed > 0 ? 1000 / r.speed : null,
  );
  const maxPace = rollingWindowMin(paceValues, 5);

  // Elevation stats
  const elevProfile = computeElevationProfile(records, session);
  const totalAscent = elevProfile?.totalAscent ?? null;
  const totalDescent = elevProfile?.totalDescent ?? null;
  const netElevation = elevProfile?.netElevation ?? null;
  const minAltitude = elevProfile?.minAltitude ?? null;
  const maxAltitude = elevProfile?.maxAltitude ?? null;

  // Zone labels
  const avgHrZone =
    avgHeartRate != null && config?.hrZones
      ? classifyZone(avgHeartRate, config.hrZones)
      : null;
  const avgPaceZone =
    avgPace != null && config?.paceZones
      ? classifyZone(avgPace, config.paceZones)
      : null;

  // Training load: NP / IF / RSS
  const normalizedPower = computeNormalizedPower(records.map((r) => r.power ?? null), 30);
  const cp = config?.calibration?.criticalPower ?? null;
  const intensityFactor =
    normalizedPower != null && cp != null ? normalizedPower / cp : null;
  const runStressScore =
    normalizedPower != null && intensityFactor != null && cp != null
      ? (movingTime * normalizedPower * intensityFactor) / (cp * 3600) * 100
      : null;

  return {
    date,
    timezone,
    duration,
    movingTime,
    distance,
    avgPower,
    avgPowerZone,
    avgHeartRate,
    avgHeartRatePctLthr,
    avgPace,
    maxHeartRate,
    maxPower,
    maxPace,
    totalAscent,
    totalDescent,
    netElevation,
    minAltitude,
    maxAltitude,
    avgHrZone,
    avgPaceZone,
    normalizedPower,
    intensityFactor,
    runStressScore,
    workout: options.workout,
    block: options.block,
    rpe: options.rpe,
    notes: options.notes,
  };
}
