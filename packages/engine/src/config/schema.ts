import * as v from "valibot";

// ---------------------------------------------------------------------------
// Snake_case → camelCase transform (applied before validation)
// ---------------------------------------------------------------------------

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function transformKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(transformKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        snakeToCamel(k),
        transformKeys(v),
      ])
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Valibot schema
// ---------------------------------------------------------------------------

const ZoneConfigSchema = v.object({
  label: v.string(),
  name: v.string(),
  min: v.number(),
  max: v.number(),
  rpe: v.optional(v.string()),
});

const SECTION_IDS = [
  "summary",
  "segments",
  "km_splits",
  "zones",
  "dynamics",
  "anomalies",
  "elevation_profile",
  "weather",
  "hr_zones",
  "pace_zones",
  "metadata",
] as const;

const COLUMN_IDS = [
  "power",
  "zone",
  "pace",
  "hr",
  "cadence",
  "gct",
  "gct_balance",
  "stride",
  "vo",
  "vo_balance",
  "fpr",
  "vr",
  "elev_gain",
  "elev_loss",
  "air_power",
  "wind",
  "temp",
] as const;

const OutputProfileConfigSchema = v.object({
  sections: v.optional(v.array(v.picklist(SECTION_IDS))),
  columns: v.optional(v.union([v.array(v.picklist(COLUMN_IDS)), v.literal("all")])),
  skipSegmentsIfSingleLap: v.optional(v.boolean()),
});

export const Run2MaxConfigSchema = v.object({
  calibration: v.optional(
    v.object({
      date: v.optional(v.string()),
      source: v.optional(v.string()),
      criticalPower: v.optional(v.number()),
      lthr: v.optional(v.number()),
    })
  ),
  powerZones: v.pipe(
    v.array(ZoneConfigSchema),
    v.minLength(1, "powerZones must contain at least one entry")
  ),
  hrZones: v.optional(v.pipe(
    v.array(ZoneConfigSchema),
    v.minLength(1, "hrZones must contain at least one entry")
  )),
  paceZones: v.optional(v.pipe(
    v.array(ZoneConfigSchema),
    v.minLength(1, "paceZones must contain at least one entry")
  )),
  weather: v.optional(v.boolean()),
  units: v.optional(v.literal("metric")),
  thresholds: v.optional(
    v.object({
      lthr: v.optional(v.number()),
      maxHr: v.optional(v.number()),
    })
  ),
  athlete: v.optional(
    v.object({
      timezone: v.optional(v.string()),
    })
  ),
  output: v.optional(
    v.object({
      default: v.optional(OutputProfileConfigSchema),
      detailed: v.optional(OutputProfileConfigSchema),
    })
  ),
});

export type Run2MaxConfig = v.InferOutput<typeof Run2MaxConfigSchema>;
export type ZoneConfig = v.InferOutput<typeof ZoneConfigSchema>;
export type OutputProfileConfig = v.InferOutput<typeof OutputProfileConfigSchema>;

// ---------------------------------------------------------------------------
// Parse function — transforms snake_case keys then validates
// ---------------------------------------------------------------------------

export function parseConfig(raw: unknown): Run2MaxConfig {
  return v.parse(Run2MaxConfigSchema, transformKeys(raw));
}
