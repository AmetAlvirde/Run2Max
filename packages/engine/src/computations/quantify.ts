import {
  parseFitBuffer,
  normalizeFFP,
  downsampleRecords,
} from "normalize-fit-file";
import type { AnalysisResult, QuantifyOptions, Run2MaxRecord } from "../types.js";
import { ENGINE_VERSION } from "../index.js";
import { detectCapabilities } from "../detect-capabilities.js";
import { detectAnomalies, applyAnomalyExclusions } from "./anomalies.js";
import { computeSummary } from "./summary.js";
import { computeSegments } from "./segments.js";
import { computeKmSplits } from "./km-splits.js";
import { computeZoneDistribution } from "./zones.js";
import { computeDynamicsSummary } from "./dynamics.js";

/**
 * Main engine entry point. Takes a raw .fit file buffer and produces
 * a complete analysis result.
 */
export async function quantify(
  fitBuffer: ArrayBuffer,
  options: QuantifyOptions = {},
): Promise<AnalysisResult> {
  // 1. Parse and normalize
  const rawData = await parseFitBuffer(fitBuffer);
  const normalized = normalizeFFP(rawData);

  // 2. Cast records and detect capabilities
  let records = normalized.records as Run2MaxRecord[];
  const capabilities = detectCapabilities(records);

  // 3. Downsample if requested
  if (options.downsample && options.downsample > 1) {
    records = downsampleRecords(records, options.downsample) as Run2MaxRecord[];
  }

  // 4. Detect anomalies
  const anomalies = detectAnomalies(records);

  // 5. Apply exclusions if requested
  if (options.excludeAnomalies) {
    records = applyAnomalyExclusions(records, anomalies);
  }

  // 6. Resolve config
  const config = options.config;
  const zones = config?.powerZones;
  const intervalSeconds = options.downsample ?? 1;

  // 7. Compute all analysis components
  const summary = computeSummary(
    records,
    normalized.session,
    normalized.metadata,
    config,
    options,
  );

  const segments = zones
    ? computeSegments(records, normalized.laps, zones, capabilities)
    : [];

  const kmSplits = computeKmSplits(records, zones, capabilities);

  const zoneDistribution = zones
    ? computeZoneDistribution(records, zones, intervalSeconds)
    : [];

  const dynamicsSummary = computeDynamicsSummary(records, capabilities);

  return {
    metadata: {
      version: ENGINE_VERSION,
      downsample: options.downsample ?? null,
      anomaliesExcluded: options.excludeAnomalies ?? false,
    },
    summary,
    segments,
    kmSplits,
    zoneDistribution,
    dynamicsSummary,
    anomalies,
    capabilities,
  };
}
