import type { Run2MaxRecord, ZoneConfig, ZoneDistributionRow } from "../types.js";

/**
 * Classify a numeric value into a zone label.
 *
 * - Within a zone's [min, max] → that zone's label
 * - Below lowest zone → "below <lowest label>"
 * - Above highest zone → "above <highest label>"
 * - In a gap between adjacent zones → "<lower label>→<upper label>"
 *
 * Works for any zone type: power, HR, or pace (sec/km).
 */
export function classifyZone(value: number, zones: ZoneConfig[]): string {
  const sorted = [...zones].sort((a, b) => a.min - b.min);

  for (const zone of sorted) {
    if (value >= zone.min && value <= zone.max) return zone.label;
  }

  if (value < sorted[0]!.min) return `below ${sorted[0]!.label}`;

  if (value > sorted[sorted.length - 1]!.max)
    return `above ${sorted[sorted.length - 1]!.label}`;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (value > sorted[i]!.max && value < sorted[i + 1]!.min) {
      return `${sorted[i]!.label}\u2192${sorted[i + 1]!.label}`;
    }
  }

  return "unknown";
}

/** Backward-compat alias — classifyZone works for all zone types. */
export const classifyPowerZone = classifyZone;

/**
 * Compute time distribution across zones using a value accessor.
 *
 * - All configured zones always appear (even with 0 seconds)
 * - Gap/out-of-range labels only appear if time > 0
 * - Each record counts as `intervalSeconds` of time
 * - Records where accessor returns null are skipped
 */
export function computeZoneDistribution(
  records: Run2MaxRecord[],
  zones: ZoneConfig[],
  intervalSeconds: number,
  accessor: (r: Run2MaxRecord) => number | null,
): ZoneDistributionRow[] {
  const sorted = [...zones].sort((a, b) => a.min - b.min);

  const timeByLabel = new Map<string, number>();
  for (const zone of sorted) {
    timeByLabel.set(zone.label, 0);
  }

  for (const record of records) {
    const value = accessor(record);
    if (value == null) continue;
    const label = classifyZone(value, sorted);
    timeByLabel.set(label, (timeByLabel.get(label) ?? 0) + intervalSeconds);
  }

  const totalSeconds = [...timeByLabel.values()].reduce((a, b) => a + b, 0);
  const configuredLabels = new Set(sorted.map((z) => z.label));

  const result: ZoneDistributionRow[] = [];

  for (const zone of sorted) {
    const seconds = timeByLabel.get(zone.label)!;
    result.push({
      label: zone.label,
      name: zone.name,
      seconds,
      percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
    });
  }

  for (const [label, seconds] of timeByLabel) {
    if (configuredLabels.has(label)) continue;
    if (seconds === 0) continue;
    result.push({
      label,
      name: label,
      seconds,
      percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
    });
  }

  return result;
}

/** Distribute time across power zones using `record.power`. */
export function computePowerZoneDistribution(
  records: Run2MaxRecord[],
  zones: ZoneConfig[],
  intervalSeconds: number,
): ZoneDistributionRow[] {
  return computeZoneDistribution(records, zones, intervalSeconds, (r) => r.power ?? null);
}

/** Distribute time across HR zones using `record.heartRate`. */
export function computeHrZoneDistribution(
  records: Run2MaxRecord[],
  zones: ZoneConfig[],
  intervalSeconds: number,
): ZoneDistributionRow[] {
  return computeZoneDistribution(records, zones, intervalSeconds, (r) => r.heartRate ?? null);
}

/**
 * Distribute time across pace zones using `record.speed`.
 * Speed (m/s) is converted to pace (sec/km) via `1000 / speed`.
 * Records with null or zero speed are skipped.
 */
export function computePaceZoneDistribution(
  records: Run2MaxRecord[],
  zones: ZoneConfig[],
  intervalSeconds: number,
): ZoneDistributionRow[] {
  return computeZoneDistribution(
    records,
    zones,
    intervalSeconds,
    (r) => r.speed != null && r.speed > 0 ? 1000 / r.speed : null,
  );
}
