import type { RecordData } from "normalize-fit-file";
import type { Run2MaxConfig } from "./config/schema.js";
export type { Run2MaxConfig, ZoneConfig, OutputProfileConfig } from "./config/schema.js";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** RecordData extended with known Tier 2 and Tier 3 fields.
 *
 * Tier 1 (Universal): fields already declared in RecordData
 * Tier 2 (Running Dynamics): standard FIT running mechanics fields
 * Tier 3 (Stryd-enhanced): Stryd developer fields, renamed by normalize-fit-file
 */
export interface Run2MaxRecord extends RecordData {
  // Tier 1 — additional fields not in RecordData base type
  elapsedTime?: number;
  timerTime?: number;

  // Tier 2 — Running Dynamics (standard FIT)
  stanceTime?: number;              // ms (GCT)
  stanceTimeBalance?: number;       // % (left/right split)
  stepLength?: number;              // mm
  verticalOscillation?: number;     // mm
  verticalOscillationBalance?: number; // %

  // Tier 3 — Stryd-enhanced
  formPower?: number;               // W
  airPower?: number;                // W
  legSpringStiffness?: number;      // kN/m
  legSpringStiffnessBalance?: number; // %
  impactLoadingRateBalance?: number;  // %
  strydImpact?: number;             // raw impact loading rate
  strydDistance?: number;           // m (Stryd's own distance)
  strydSpeed?: number;              // m/s (Stryd's own speed)
  strydHumidity?: number;           // %
  strydTemperature?: number;        // °C
}

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

export interface DataCapabilities {
  hasRunningDynamics: boolean; // Tier 2: stanceTime, stepLength, verticalOscillation
  hasStrydEnhanced: boolean;   // Tier 3: formPower, airPower, legSpringStiffness, etc.
}

// ---------------------------------------------------------------------------
// Quantify options
// ---------------------------------------------------------------------------

export interface QuantifyOptions {
  config?: Run2MaxConfig;
  workout?: string;
  block?: string;
  rpe?: number;
  notes?: string;
  timezone?: string;
  downsample?: number;
  excludeAnomalies?: boolean;
}

// ---------------------------------------------------------------------------
// Analysis output types
// ---------------------------------------------------------------------------

export interface RunSummary {
  date: Date;
  timezone: string;
  duration: number;               // seconds
  movingTime: number;             // seconds
  distance: number;               // meters
  avgPower: number | null;
  avgPowerZone: string | null;    // zone label, null if no zones configured
  avgHeartRate: number | null;
  avgHeartRatePctLthr: number | null; // null if no lthr configured
  avgPace: number | null;         // seconds per km
  // Max values
  maxHeartRate: number | null;    // instantaneous single-record max
  maxPower: number | null;        // 5s rolling window peak
  maxPace: number | null;         // 5s rolling window peak (lower = faster)
  // Elevation stats
  totalAscent: number | null;     // meters
  totalDescent: number | null;    // meters
  netElevation: number | null;    // ascent - descent
  minAltitude: number | null;     // meters
  maxAltitude: number | null;     // meters
  // Zone labels
  avgHrZone: string | null;       // HR zone label
  avgPaceZone: string | null;     // pace zone label
  // Training load
  normalizedPower: number | null; // Coggan NP
  intensityFactor: number | null; // NP/CP (null without CP)
  runStressScore: number | null;  // Coggan TSS, labeled RSS (r2m)
  // Context metadata
  workout?: string;
  block?: string;
  rpe?: number;
  notes?: string;
}

export interface SegmentRow {
  lapIndex: number;
  distance: number;               // meters
  duration: number;               // seconds
  avgPower: number | null;
  zone: string | null;
  avgPace: number | null;         // seconds per km
  avgHeartRate: number | null;
  avgCadence: number | null;
  // Tier 2
  avgStanceTime: number | null;           // ms
  avgStanceTimeBalance: number | null;    // %
  avgStepLength: number | null;           // mm
  avgVerticalOscillation: number | null;  // mm
  // Derived
  formPowerRatio: number | null;          // formPower / power (Tier 3)
  verticalRatio: number | null;           // (verticalOscillation / stepLength) * 100 (Tier 2)
  // Elevation
  elevGain: number | null;                // meters gained in this split
  elevLoss: number | null;                // meters lost in this split
  // Weather / Tier 3
  avgAirPower: number | null;             // W (Tier 3)
  windSpeed: number | null;               // km/h (from weather API)
  windDirection: number | null;           // degrees
  temperature: number | null;             // Celsius
}

export interface KmSplitRow {
  km: number;
  distance: number;               // meters (may be < 1000 for last split)
  duration: number;               // seconds
  avgPower: number | null;
  zone: string | null;
  avgPace: number | null;         // seconds per km
  avgHeartRate: number | null;
  avgCadence: number | null;
  // Tier 2
  avgStanceTime: number | null;           // ms
  avgStanceTimeBalance: number | null;    // %
  avgStepLength: number | null;           // mm
  avgVerticalOscillation: number | null;  // mm
  // Derived
  formPowerRatio: number | null;          // formPower / power (Tier 3)
  verticalRatio: number | null;           // (verticalOscillation / stepLength) * 100 (Tier 2)
  // Elevation
  elevGain: number | null;                // meters gained in this split
  elevLoss: number | null;                // meters lost in this split
  // Weather / Tier 3
  avgAirPower: number | null;             // W (Tier 3)
  windSpeed: number | null;               // km/h (from weather API)
  windDirection: number | null;           // degrees
  temperature: number | null;             // Celsius
}

export interface ElevationProfile {
  totalAscent: number;
  totalDescent: number;
  netElevation: number;
  minAltitude: number;
  maxAltitude: number;
  points: [number, number][];     // [distanceKm, altitudeM]
}

export interface WeatherSummary {
  temperature: number;
  humidity: number;
  dewPoint: number;
  windSpeed: number;
  windDirection: number;
  conditions: string;
}

export interface WeatherPerSplit {
  km: number;
  temperature: number;
  humidity: number;
  dewPoint: number;
  windSpeed: number;
  windDirection: number;
}

export interface ZoneDistributionRow {
  label: string;
  name: string;
  seconds: number;
  percentage: number;
}

export interface DynamicsSummary {
  // Tier 2
  avgStanceTime: number | null;              // ms
  avgStanceTimeBalance: number | null;       // %
  avgStepLength: number | null;              // mm
  avgVerticalOscillation: number | null;     // mm
  avgVerticalOscillationBalance: number | null; // %
  // Tier 3
  avgFormPower: number | null;               // W
  avgAirPower: number | null;                // W
  avgLegSpringStiffness: number | null;      // kN/m
  avgLegSpringStiffnessBalance: number | null; // %
  avgFormPowerRatio: number | null;          // formPower / power
  avgVerticalRatio: number | null;           // (verticalOscillation / stepLength) * 100
}

export interface Anomaly {
  type: "zero_value" | "spike" | "missing";
  field: string;
  description: string;
  affectedRecords: number;
  excluded: boolean; // true if removed from aggregations via --exclude-anomalies
}

export interface AnalysisResult {
  metadata: AnalysisMetadata;
  summary: RunSummary;
  segments: SegmentRow[];
  kmSplits: KmSplitRow[];
  zoneDistribution: ZoneDistributionRow[];
  hrZoneDistribution: ZoneDistributionRow[];
  paceZoneDistribution: ZoneDistributionRow[];
  dynamicsSummary: DynamicsSummary | null; // null when no Tier 2/3 data
  elevationProfile: ElevationProfile | null;
  weatherSummary: WeatherSummary | null;
  weatherPerSplit: WeatherPerSplit[];
  anomalies: Anomaly[];
  capabilities: DataCapabilities;
}

// ---------------------------------------------------------------------------
// Formatter types
// ---------------------------------------------------------------------------

export type SectionId =
  | "summary"
  | "segments"
  | "km_splits"
  | "zones"
  | "dynamics"
  | "anomalies"
  | "elevation_profile"
  | "weather"
  | "hr_zones"
  | "pace_zones"
  | "metadata";

export type ColumnId =
  | "power"
  | "zone"
  | "pace"
  | "hr"
  | "cadence"
  | "gct"
  | "gct_balance"
  | "stride"
  | "vo"
  | "vo_balance"
  | "fpr"
  | "vr"
  | "elev_gain"
  | "elev_loss"
  | "air_power"
  | "wind"
  | "temp";

export type OutputFormat = "markdown" | "json" | "yaml";

export interface AnalysisMetadata {
  version: string;
  downsample: number | null;
  anomaliesExcluded: boolean;
  fileSampleRate: number | null;  // modal interval in seconds
}

export interface FormatResult {
  output: string;
  warnings: string[];
}
