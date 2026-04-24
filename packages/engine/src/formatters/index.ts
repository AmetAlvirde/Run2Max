import type {
  AnalysisResult,
  AnalysisMetadata,
  ColumnId,
  DataCapabilities,
  FormatResult,
  OutputFormat,
  RunSummary,
  SegmentRow,
  KmSplitRow,
  ZoneDistributionRow,
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
  sections: ["summary", "segments", "km_splits", "zones", "dynamics", "anomalies"],
  columns: "all",
  skipSegmentsIfSingleLap: false,
};

const ALL_COLUMN_IDS: ColumnId[] = [
  "power", "zone", "pace", "hr", "cadence",
  "gct", "gct_balance", "stride", "vo", "vo_balance", "fpr", "vr",
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
  dynamicsSummary?: DynamicsSummary | null;
  anomalies?: Anomaly[];
}

// ---------------------------------------------------------------------------
// reconcileColumns — drop columns that require unavailable capabilities
// ---------------------------------------------------------------------------

function reconcileColumns(
  requested: ColumnId[] | "all",
  caps: DataCapabilities,
  zoneDistribution: ZoneDistributionRow[],
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
    "summary", "segments", "km_splits", "zones", "dynamics", "anomalies",
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
  };

  if (activeSections.includes("summary"))   filtered.summary = result.summary;
  if (activeSections.includes("segments"))  filtered.segments = result.segments;
  if (activeSections.includes("km_splits")) filtered.kmSplits = result.kmSplits;
  if (activeSections.includes("zones"))     filtered.zoneDistribution = result.zoneDistribution;
  if (activeSections.includes("dynamics"))  filtered.dynamicsSummary = result.dynamicsSummary;
  if (activeSections.includes("anomalies")) filtered.anomalies = result.anomalies;

  return { filtered, activeSections, warnings };
}

// ---------------------------------------------------------------------------
// formatResult — public entry point
// ---------------------------------------------------------------------------

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
