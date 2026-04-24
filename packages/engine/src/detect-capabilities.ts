import type { Run2MaxRecord, DataCapabilities } from "./types.js";

const TIER2_FIELDS = ["stanceTime", "stepLength", "verticalOscillation"] as const;
const TIER3_FIELDS = ["formPower", "airPower", "legSpringStiffness"] as const;

function hasAnyField(
  records: Run2MaxRecord[],
  fields: readonly string[]
): boolean {
  return records.some((r) => fields.some((f) => r[f] != null));
}

/**
 * Scan all records and return which data tiers are present.
 * A capability is true if at least one record has a non-nullish value
 * for any of that tier's representative fields.
 */
export function detectCapabilities(records: Run2MaxRecord[]): DataCapabilities {
  return {
    hasRunningDynamics: hasAnyField(records, TIER2_FIELDS),
    hasStrydEnhanced: hasAnyField(records, TIER3_FIELDS),
  };
}
