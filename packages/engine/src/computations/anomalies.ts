import type { Run2MaxRecord, Anomaly } from "../types.js";

// ---------------------------------------------------------------------------
// Detection rules (MVP: zero-value only)
// ---------------------------------------------------------------------------

interface AnomalyRule {
  field: keyof Run2MaxRecord & string;
  check: (value: unknown) => boolean;
}

const RULES: AnomalyRule[] = [
  { field: "heartRate", check: (v) => v === 0 },
  { field: "legSpringStiffness", check: (v) => v === 0 },
];

// ---------------------------------------------------------------------------
// Time formatting helper
// ---------------------------------------------------------------------------

function formatSeconds(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Clustering: group contiguous anomalous records per field
// ---------------------------------------------------------------------------

interface RawCluster {
  field: string;
  startIndex: number;
  endIndex: number; // inclusive
}

function clusterAnomalies(
  records: Run2MaxRecord[],
  rule: AnomalyRule,
): RawCluster[] {
  const clusters: RawCluster[] = [];
  let current: RawCluster | null = null;

  for (let i = 0; i < records.length; i++) {
    const value = records[i][rule.field];
    if (value != null && rule.check(value)) {
      if (current) {
        current.endIndex = i;
      } else {
        current = { field: rule.field, startIndex: i, endIndex: i };
      }
    } else {
      if (current) {
        clusters.push(current);
        current = null;
      }
    }
  }
  if (current) clusters.push(current);

  return clusters;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const WARMUP_THRESHOLD_INDEX = 30; // first 30 records (~30s at 1s intervals)

/**
 * Scan records for known anomalies. Returns one Anomaly per contiguous cluster.
 * All anomalies are returned with `excluded: false`.
 */
export function detectAnomalies(records: Run2MaxRecord[]): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const rule of RULES) {
    const clusters = clusterAnomalies(records, rule);

    for (const cluster of clusters) {
      const count = cluster.endIndex - cluster.startIndex + 1;
      const startTime = formatSeconds(cluster.startIndex);
      const endTime = formatSeconds(cluster.endIndex);

      const isWarmup = cluster.startIndex < WARMUP_THRESHOLD_INDEX;
      const hint = isWarmup ? "likely sensor warmup" : "sensor dropout";

      const timeRange =
        count === 1
          ? `at ${startTime}`
          : `at ${startTime}\u2013${endTime}`;

      anomalies.push({
        type: "zero_value",
        field: cluster.field,
        description: `${cluster.field}=0 for ${count}s ${timeRange} (${hint})`,
        affectedRecords: count,
        excluded: false,
      });
    }
  }

  return anomalies;
}

/**
 * Returns a new records array with anomalous field values set to null.
 * Also sets `excluded = true` on each anomaly.
 *
 * Only the affected field is nulled — the rest of the record stays intact.
 */
export function applyAnomalyExclusions(
  records: Run2MaxRecord[],
  anomalies: Anomaly[],
): Run2MaxRecord[] {
  for (const anomaly of anomalies) {
    anomaly.excluded = true;
  }

  return records.map((record) => {
    let copy: Run2MaxRecord | undefined;

    for (const rule of RULES) {
      const value = record[rule.field];
      if (value != null && rule.check(value)) {
        if (!copy) copy = { ...record };
        (copy as Record<string, unknown>)[rule.field] = null;
      }
    }

    return copy ?? record;
  });
}
