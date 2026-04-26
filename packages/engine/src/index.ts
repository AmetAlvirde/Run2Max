export const ENGINE_VERSION = "1.1.0";

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
  ElevationProfile,
  WeatherSummary,
  WeatherPerSplit,
  PlanContext,
} from "./types.js";

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

export { detectCapabilities } from "./detect-capabilities.js";
export { loadConfig } from "./config/loader.js";
export type { LoadConfigOptions } from "./config/loader.js";
export type { MicrocycleConfig } from "./config/schema.js";

// ---------------------------------------------------------------------------
// quantify — main engine entry point
// ---------------------------------------------------------------------------

export { quantify } from "./computations/quantify.js";

// ---------------------------------------------------------------------------
// Computation utilities (useful for direct consumption / testing)
// ---------------------------------------------------------------------------

export { classifyZone, classifyPowerZone, computeZoneDistribution } from "./computations/zones.js";
export { computeSegments } from "./computations/segments.js";
export { computeKmSplits } from "./computations/km-splits.js";
export { computeDynamicsSummary } from "./computations/dynamics.js";
export { computeSummary } from "./computations/summary.js";
export { detectAnomalies, applyAnomalyExclusions } from "./computations/anomalies.js";
export { computeElevationProfile } from "./computations/elevation.js";
export { computeNormalizedPower } from "./computations/utils.js";

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

// ---------------------------------------------------------------------------
// Plan schema, types, and validation
// ---------------------------------------------------------------------------

export { parsePlan, PLANNED_WEEK_TYPES, EXECUTED_ONLY_TYPES, ALL_WEEK_TYPES, REASON_CATEGORIES, KNOWN_DISTANCES } from "./plan/schema.js";
export type { Plan, Mesocycle, Fractal, Week, TestingPeriod } from "./plan/schema.js";
export { validatePlan } from "./plan/validate.js";
export type { Diagnostic } from "./plan/validate.js";
export { loadPlan, loadUserTemplates, resolveTemplate } from "./plan/loader.js";
export { buildPlanFromTemplate } from "./plan/build.js";
export type { BuildPlanOptions } from "./plan/build.js";
export { reconcile } from "./plan/reconcile.js";
export type { ReconcileOptions, ReconciliationResult, CompressionOption } from "./plan/reconcile.js";
export { getPlanStatus, formatDefaultView, formatFullView } from "./plan/status.js";
export type { PlanStatus, WeekStatusEntry, NextMilestone, WeekMarker, PlanStatusOptions } from "./plan/status.js";
export { detectWeekDeviations, reportHasAnomalies } from "./plan/detect.js";
export type { DeviationReport, WeekRun } from "./plan/detect.js";
export { syncWeek, SyncError } from "./plan/sync.js";
export type { SyncData } from "./plan/sync.js";
export { adjustPlan, AdjustError } from "./plan/adjust.js";
export type { AdjustOptions, AdjustResult } from "./plan/adjust.js";
export { associateRun, scanBlockRuns, extractDisplayName } from "./plan/associate.js";
export type { WeekAssociation, BlockRun } from "./plan/associate.js";

// ---------------------------------------------------------------------------
// Plan templates
// ---------------------------------------------------------------------------

export type { PlanTemplate } from "./plan/templates/types.js";
export { BUILTIN_TEMPLATES, getBuiltinTemplate } from "./plan/templates/builtin.js";
