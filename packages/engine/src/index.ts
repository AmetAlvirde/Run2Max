export const ENGINE_VERSION = "0.0.1";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type {
  Run2MaxRecord,
  DataCapabilities,
  QuantifyOptions,
  AnalysisResult,
  RunSummary,
  SegmentRow,
  KmSplitRow,
  ZoneDistributionRow,
  DynamicsSummary,
  Anomaly,
  Run2MaxConfig,
  ZoneConfig,
  OutputProfileConfig,
} from "./types.js";

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export { detectCapabilities } from "./detect-capabilities.js";
export { loadConfig } from "./config/loader.js";
export type { LoadConfigOptions } from "./config/loader.js";

// ---------------------------------------------------------------------------
// quantify — main engine entry point
// ---------------------------------------------------------------------------

export { quantify } from "./computations/quantify.js";

// ---------------------------------------------------------------------------
// Computation utilities (useful for direct consumption / testing)
// ---------------------------------------------------------------------------

export { classifyPowerZone, computeZoneDistribution } from "./computations/zones.js";
export { computeSegments } from "./computations/segments.js";
export { computeKmSplits } from "./computations/km-splits.js";
export { computeDynamicsSummary } from "./computations/dynamics.js";
export { computeSummary } from "./computations/summary.js";
export { detectAnomalies, applyAnomalyExclusions } from "./computations/anomalies.js";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export { formatResult, DEFAULT_PROFILE } from "./formatters/index.js";
export type {
  FormatResult,
  OutputFormat,
  SectionId,
  ColumnId,
  AnalysisMetadata,
} from "./types.js";
