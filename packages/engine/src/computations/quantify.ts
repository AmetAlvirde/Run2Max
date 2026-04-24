import {
  parseFitBuffer,
  normalizeFFP,
  downsampleRecords,
} from "normalize-fit-file";
import type {
  AnalysisResult,
  QuantifyOptions,
  Run2MaxRecord,
  WeatherSummary,
  WeatherPerSplit,
  SegmentRow,
  KmSplitRow,
} from "../types.js";
import { ENGINE_VERSION } from "../index.js";
import { detectCapabilities } from "../detect-capabilities.js";
import { detectAnomalies, applyAnomalyExclusions } from "./anomalies.js";
import { computeSummary } from "./summary.js";
import { computeSegments } from "./segments.js";
import { computeKmSplits } from "./km-splits.js";
import { computePowerZoneDistribution } from "./zones.js";
import { computeDynamicsSummary } from "./dynamics.js";
import {
  extractGpsCoordinates,
  fetchWeather,
  interpolateWeatherToSplits,
} from "./weather.js";

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
    ? computePowerZoneDistribution(records, zones, intervalSeconds)
    : [];

  const dynamicsSummary = computeDynamicsSummary(records, capabilities);

  // 8. Weather fetch (async) — skip if no GPS or config.weather === false
  let weatherSummary: WeatherSummary | null = null;
  let weatherPerSplit: WeatherPerSplit[] = [];
  let finalKmSplits: KmSplitRow[] = kmSplits;
  let finalSegments: SegmentRow[] = segments;

  const gps = extractGpsCoordinates(records);
  if (gps && config?.weather !== false) {
    const weatherResult = await fetchWeather(gps.lat, gps.lon, summary.date);
    if (weatherResult) {
      weatherSummary = weatherResult.summary;
      weatherPerSplit = interpolateWeatherToSplits(
        weatherResult.hourlyData,
        kmSplits,
        summary.date,
      );
      // Merge wind and temperature into km splits
      finalKmSplits = kmSplits.map((split, i) => {
        const w = weatherPerSplit[i];
        return w
          ? { ...split, windSpeed: w.windSpeed, windDirection: w.windDirection, temperature: w.temperature }
          : split;
      });
      // Merge run-midpoint weather into segments
      const midWeather = weatherPerSplit[Math.floor(weatherPerSplit.length / 2)];
      if (midWeather) {
        finalSegments = segments.map((s) => ({
          ...s,
          windSpeed: midWeather.windSpeed,
          windDirection: midWeather.windDirection,
          temperature: midWeather.temperature,
        }));
      }
    }
  }

  return {
    metadata: {
      version: ENGINE_VERSION,
      downsample: options.downsample ?? null,
      anomaliesExcluded: options.excludeAnomalies ?? false,
      fileSampleRate: null,  // computed in Phase 10
    },
    summary,
    segments: finalSegments,
    kmSplits: finalKmSplits,
    zoneDistribution,
    hrZoneDistribution: [],
    paceZoneDistribution: [],
    dynamicsSummary,
    elevationProfile: null,
    weatherSummary,
    weatherPerSplit,
    anomalies,
    capabilities,
  };
}
