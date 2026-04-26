import type {
  AnalysisResult,
  AnalysisMetadata,
  ColumnId,
  DataCapabilities,
  ElevationProfile,
  FormatResult,
  OutputFormat,
  PlanContext,
  RunSummary,
  SegmentRow,
  KmSplitRow,
  ZoneDistributionRow,
  WeatherSummary,
  WeatherPerSplit,
  DynamicsSummary,
  Anomaly,
  SectionId,
} from "../types.js";
import type { OutputProfileConfig } from "../config/schema.js";
import { TIER_REQUIREMENTS } from "./utils.js";
import { formatMarkdown } from "./markdown.js";
import { formatJson } from "./json.js";
import { formatYaml } from "./yaml.js";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PROFILE: OutputProfileConfig = {
  sections: ["summary", "elevation_profile", "weather", "segments", "km_splits", "zones", "dynamics", "anomalies", "metadata"],
  columns: "all",
  skipSegmentsIfSingleLap: true,
};

const ALL_COLUMN_IDS: ColumnId[] = [
  "power", "zone", "pace", "hr", "cadence",
  "gct", "gct_balance", "stride", "vo", "vo_balance", "fpr", "vr",
  "elev_gain", "elev_loss", "air_power", "wind", "temp",
];

// ---------------------------------------------------------------------------
// Internal filtered result shape
// ---------------------------------------------------------------------------

interface FilteredResult {
  metadata: AnalysisMetadata;
  capabilities: DataCapabilities;
  summary?: RunSummary;
  segments?: SegmentRow[];
  kmSplits?: KmSplitRow[];
  zoneDistribution?: ZoneDistributionRow[];
  hrZoneDistribution?: ZoneDistributionRow[];
  paceZoneDistribution?: ZoneDistributionRow[];
  dynamicsSummary?: DynamicsSummary | null;
  elevationProfile?: ElevationProfile | null;
  weatherSummary?: WeatherSummary | null;
  weatherPerSplit?: WeatherPerSplit[];
  anomalies?: Anomaly[];
  /** Periodization context — always passed through when present on AnalysisResult. */
  planContext?: PlanContext;
}

// ---------------------------------------------------------------------------
// reconcileColumns — drop columns that require unavailable capabilities
// ---------------------------------------------------------------------------

function reconcileColumns(
  requested: ColumnId[] | "all",
  caps: DataCapabilities,
  zoneDistribution: ZoneDistributionRow[],
  hasElevation: boolean,
  hasWeather: boolean,
): { columns: ColumnId[]; warnings: string[] } {
  const candidates = requested === "all" ? [...ALL_COLUMN_IDS] : [...requested];
  const columns: ColumnId[] = [];
  const warnings: string[] = [];

  for (const col of candidates) {
    const requiredCap = TIER_REQUIREMENTS[col];
    if (requiredCap && !caps[requiredCap]) {
      warnings.push(`Column "${col}" dropped: requires ${requiredCap} (not available in this file)`);
      continue;
    }
    if (col === "zone" && zoneDistribution.length === 0) {
      warnings.push(`Column "zone" dropped: no zone configuration`);
      continue;
    }
    if ((col === "elev_gain" || col === "elev_loss") && !hasElevation) {
      warnings.push(`Column "${col}" dropped: no elevation data available`);
      continue;
    }
    if ((col === "wind" || col === "temp") && !hasWeather) {
      warnings.push(`Column "${col}" dropped: no weather data available`);
      continue;
    }
    columns.push(col);
  }

  return { columns, warnings };
}

// ---------------------------------------------------------------------------
// applyProfile — filter result to active sections; handle skipSegmentsIfSingleLap
// ---------------------------------------------------------------------------

function applyProfile(
  result: AnalysisResult,
  profile: OutputProfileConfig,
): { filtered: FilteredResult; activeSections: SectionId[]; warnings: string[] } {
  const allSections: SectionId[] = [
    "summary", "elevation_profile", "weather", "segments", "km_splits",
    "zones", "hr_zones", "pace_zones", "dynamics", "anomalies", "metadata",
  ];
  let activeSections: SectionId[] = profile.sections ?? allSections;
  const warnings: string[] = [];

  // skipSegmentsIfSingleLap
  if (
    profile.skipSegmentsIfSingleLap &&
    result.segments.length <= 1 &&
    activeSections.includes("segments")
  ) {
    activeSections = activeSections.filter(s => s !== "segments");
    warnings.push("Segments section skipped: only one lap detected");
  }

  const filtered: FilteredResult = {
    metadata: result.metadata,
    capabilities: result.capabilities,
    // planContext is always forwarded — not gated by any profile section
    planContext: result.planContext,
  };

  if (activeSections.includes("summary"))           filtered.summary = result.summary;
  if (activeSections.includes("elevation_profile")) filtered.elevationProfile = result.elevationProfile;
  if (activeSections.includes("weather")) {
    filtered.weatherSummary = result.weatherSummary;
    filtered.weatherPerSplit = result.weatherPerSplit;
  }
  if (activeSections.includes("segments"))    filtered.segments = result.segments;
  if (activeSections.includes("km_splits"))   filtered.kmSplits = result.kmSplits;
  if (activeSections.includes("zones"))       filtered.zoneDistribution = result.zoneDistribution;
  if (activeSections.includes("hr_zones"))    filtered.hrZoneDistribution = result.hrZoneDistribution;
  if (activeSections.includes("pace_zones"))  filtered.paceZoneDistribution = result.paceZoneDistribution;
  if (activeSections.includes("dynamics"))    filtered.dynamicsSummary = result.dynamicsSummary;
  if (activeSections.includes("anomalies"))   filtered.anomalies = result.anomalies;

  return { filtered, activeSections, warnings };
}

// ---------------------------------------------------------------------------
// formatResult — public entry point
// ---------------------------------------------------------------------------

/**
 * Formats an AnalysisResult into markdown, JSON, or YAML.
 * Profile controls which sections and columns are included.
 * Returns { output, warnings } — warnings are non-fatal (e.g. dropped columns).
 */
export function formatResult(
  result: AnalysisResult,
  format: OutputFormat,
  profile: OutputProfileConfig,
): FormatResult {
  const { filtered, activeSections, warnings: sectionWarnings } = applyProfile(result, profile);

  const { columns, warnings: colWarnings } = reconcileColumns(
    profile.columns ?? "all",
    result.capabilities,
    result.zoneDistribution,
    result.elevationProfile != null,
    result.weatherSummary != null,
  );

  const warnings = [...sectionWarnings, ...colWarnings];

  let output: string;
  if (format === "markdown") {
    output = formatMarkdown(filtered, activeSections, columns);
  } else if (format === "json") {
    output = formatJson(filtered, columns);
  } else {
    output = formatYaml(filtered, columns);
  }

  return { output, warnings };
}
