export const ENGINE_VERSION = "1.1.0";

// ---------------------------------------------------------------------------
// Periodization
// ---------------------------------------------------------------------------

export type { MicrocycleConfig } from "./config/schema.js";
export { REASON_CATEGORIES } from "./plan/schema.js";
export type { Plan, TestingPeriod } from "./plan/types.js";
export { validatePlan } from "./plan/validate.js";
export type { Diagnostic } from "./plan/validate.js";
export { loadPlan } from "./plan/loader.js";
// TODO(sub-issue #50): replace with resolvePlanTemplate(name, { userTemplatesDir }).
export { loadUserTemplates } from "./plan/loader.js";
// TODO(sub-issue #50): replace with resolvePlanTemplate(name, { userTemplatesDir }).
export { resolveTemplate } from "./plan/loader.js";
// TODO(sub-issue #50): replace with listPlanTemplates({ userTemplatesDir }).
export { BUILTIN_TEMPLATES } from "./plan/templates/builtin.js";
export { buildPlanFromTemplate } from "./plan/build.js";
export { reconcile } from "./plan/reconcile.js";
export { getPlanStatus } from "./plan/status.js";
export { detectWeekDeviations, reportHasAnomalies } from "./plan/detect.js";
export type { DeviationReport } from "./plan/detect.js";
export { syncWeek, SyncError } from "./plan/sync.js";
export type { SyncData } from "./plan/sync.js";
export { adjustPlan, AdjustError } from "./plan/adjust.js";
export { walkPlan } from "./plan/walk.js";

// ---------------------------------------------------------------------------
// Runs and capture
// ---------------------------------------------------------------------------

export { scanBlockRuns } from "./plan/associate.js";

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
export { formatResult } from "./formatters/index.js";
export type { OutputFormat } from "./types.js";
// TODO(sub-issue #51): replace with formatPlanStatus(status, { view: "default" }).
export { formatDefaultView } from "./formatters/plan.js";
// TODO(sub-issue #51): replace with formatPlanStatus(status, { view: "full" }).
export { formatFullView } from "./formatters/plan.js";

// ---------------------------------------------------------------------------
// Infrastructure
// ---------------------------------------------------------------------------

export type { OutputProfileConfig } from "./types.js";
export { loadConfig } from "./config/loader.js";
export { DEFAULT_PROFILE } from "./formatters/index.js";
export { addDays } from "./plan/dates.js";
export { transformKeysCamelToSnake } from "./plan/case-keys.js";
