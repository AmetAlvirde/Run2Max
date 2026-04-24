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
  summary: RunSummary;
  segments: SegmentRow[];
  kmSplits: KmSplitRow[];
  zoneDistribution: ZoneDistributionRow[];
  dynamicsSummary: DynamicsSummary | null; // null when no Tier 2/3 data
  anomalies: Anomaly[];
  capabilities: DataCapabilities;
}
