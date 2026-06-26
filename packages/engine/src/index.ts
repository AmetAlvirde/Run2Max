export const ENGINE_VERSION = "2.1.0";

// ---------------------------------------------------------------------------
// Periodization
// ---------------------------------------------------------------------------

export type { MicrocycleConfig } from "./config/schema.js";
export { REASON_CATEGORIES } from "./plan/schema.js";
export type {
  Plan,
  TestingPeriod,
  PrescribedRun,
  PrescribedStep,
  PrescribedStepTarget,
  TargetRange,
} from "./plan/types.js";
export { validatePlan } from "./plan/validate.js";
export type { Diagnostic } from "./plan/validate.js";
export { loadPlan } from "./plan/loader.js";
export { parsePrescriptionNotation, PrescriptionNotationError } from "./plan/prescription.js";
export type { PrescriptionDiagnostic } from "./plan/prescription.js";
export { resolvePlanTemplate, listPlanTemplates } from "./plan/templates/lookup.js";
export { buildPlanFromTemplate } from "./plan/build.js";
export { reconcile } from "./plan/reconcile.js";
export { getPlanStatus } from "./plan/status.js";
export { detectWeekDeviations, reportHasAnomalies } from "./plan/detect.js";
export type { DeviationReport } from "./plan/detect.js";
export { syncWeek, SyncError } from "./plan/sync.js";
export type { SyncData } from "./plan/sync.js";
export { adjustPlan, AdjustError } from "./plan/adjust.js";
export { walkPlan } from "./plan/walk.js";
export { readHistoryArtifacts } from "./plan/history.js";
export type {
  HistoryArtifactDescriptor,
  HistoryArtifactEligible,
  HistoryArtifactUnavailable,
  HistoryArtifactReport,
  ReadHistoryArtifactsOptions,
  HistoryRequiredField,
} from "./plan/history.js";

// ---------------------------------------------------------------------------
// Runs and capture
// ---------------------------------------------------------------------------

export { scanBlockRuns, findPrescribedRun, PrescribedRunOverrideError } from "./plan/associate.js";
export type {
  FindPrescribedRunOptions,
  FindPrescribedRunReason,
  FindPrescribedRunResult,
  PrescribedRunMatch,
} from "./plan/associate.js";

// ---------------------------------------------------------------------------
// Metrics and zones
// ---------------------------------------------------------------------------
// (No public exports today - Zone, CP, eFTP, LTHR, NP, IF, RSS are glossary
// terms operated on by Analysis output APIs. Banner is kept to preserve the
// four-domain-plus-Infrastructure structure required by the cycle PRD
// encounter statement.)

// ---------------------------------------------------------------------------
// Analysis output
// ---------------------------------------------------------------------------

export { quantify } from "./computations/quantify.js";
export { comparePrescriptionToSegments } from "./computations/prescription-comparison.js";
export { computeComparableHistoryDelta } from "./computations/comparable-history.js";
export {
  computeRunComparison,
  extractRunComparisonSide,
} from "./computations/run-comparison.js";
export { loadRunComparisonSide } from "./artifacts/run-comparison.js";
export type {
  RunComparison,
  RunComparisonSide,
  RunComparisonMetricDelta,
  RunComparisonMetricDeltaAvailable,
  RunComparisonMetricDeltaUnavailable,
  RunComparisonPerformanceMetric,
  RunComparisonConditionsMetric,
  RunComparisonContextField,
  RunComparisonUnavailableReason,
} from "./computations/run-comparison.js";
export { formatRunComparison } from "./formatters/run-comparison.js";
export { formatResult } from "./formatters/index.js";
export type {
  ComparableHistoryMetric,
  ComparableHistoryUnavailableReason,
  ComparableHistoryMetricDelta,
  ComparableHistoryMetricDeltaAvailable,
  ComparableHistoryMetricDeltaUnavailable,
  ComparableHistoryRunDelta,
} from "./computations/comparable-history.js";
export type {
  ComparableHistory,
  ComparableHistoryAvailable,
  ComparableHistoryUnavailable,
  OutputFormat,
  PrescriptionComparison,
  PrescriptionComparisonAvailable,
  PrescriptionComparisonUnavailable,
  PrescriptionComparisonRunContext,
  PrescriptionComparisonRunActuals,
  PrescriptionStepComparison,
} from "./types.js";
export { formatPlanStatus } from "./formatters/plan.js";

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export type { OutputProfileConfig } from "./types.js";
export { loadConfig } from "./config/loader.js";
export { DEFAULT_PROFILE } from "./formatters/index.js";
export { addDays } from "./plan/dates.js";
export { transformKeysCamelToSnake } from "./plan/case-keys.js";
