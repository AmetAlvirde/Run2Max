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
// quantify — main engine entry point (implemented in Phase 3)
// ---------------------------------------------------------------------------

import type { AnalysisResult, QuantifyOptions } from "./types.js";

export async function quantify(
  _fitBuffer: ArrayBuffer,
  _options?: QuantifyOptions
): Promise<AnalysisResult> {
  throw new Error("Not implemented — coming in Phase 3");
}
