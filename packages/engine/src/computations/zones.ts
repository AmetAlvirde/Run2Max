import type { Run2MaxRecord, ZoneConfig, ZoneDistributionRow } from "../types.js";

/**
 * Classify a power value into a zone label.
 *
 * - Within a zone's [min, max] → that zone's label
 * - Below lowest zone → "below <lowest label>"
 * - Above highest zone → "above <highest label>"
 * - In a gap between adjacent zones → "<lower label>→<upper label>"
 */
export function classifyPowerZone(
  power: number,
  zones: ZoneConfig[],
): string {
  const sorted = [...zones].sort((a, b) => a.min - b.min);

  // Check each zone for a direct match
  for (const zone of sorted) {
    if (power >= zone.min && power <= zone.max) return zone.label;
  }

  // Below all zones
  if (power < sorted[0].min) return `below ${sorted[0].label}`;

  // Above all zones
  if (power > sorted[sorted.length - 1].max)
    return `above ${sorted[sorted.length - 1].label}`;

  // In a gap between two zones
  for (let i = 0; i < sorted.length - 1; i++) {
    if (power > sorted[i].max && power < sorted[i + 1].min) {
      return `${sorted[i].label}\u2192${sorted[i + 1].label}`;
    }
  }

  return "unknown";
}

/**
 * Compute time distribution across power zones.
 *
 * - All configured zones always appear (even with 0 seconds)
 * - Gap/out-of-range labels only appear if time > 0
 * - Each record counts as `intervalSeconds` of time
 */
export function computeZoneDistribution(
  records: Run2MaxRecord[],
  zones: ZoneConfig[],
  intervalSeconds: number,
): ZoneDistributionRow[] {
  const sorted = [...zones].sort((a, b) => a.min - b.min);

  // Accumulate seconds per label
  const timeByLabel = new Map<string, number>();

  // Initialize configured zones to 0
  for (const zone of sorted) {
    timeByLabel.set(zone.label, 0);
  }

  // Classify each record
  for (const record of records) {
    if (record.power == null) continue;
    const label = classifyPowerZone(record.power, sorted);
    timeByLabel.set(label, (timeByLabel.get(label) ?? 0) + intervalSeconds);
  }

  const totalSeconds = [...timeByLabel.values()].reduce((a, b) => a + b, 0);

  // Build result: configured zones first (in order), then any extras
  const result: ZoneDistributionRow[] = [];
  const configuredLabels = new Set(sorted.map((z) => z.label));

  // Configured zones — always included
  for (const zone of sorted) {
    const seconds = timeByLabel.get(zone.label)!;
    result.push({
      label: zone.label,
      name: zone.name,
      seconds,
      percentage: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
    });
  }

  // Gap / out-of-range zones — only if time > 0
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
