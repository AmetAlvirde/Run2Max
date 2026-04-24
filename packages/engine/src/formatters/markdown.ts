import type {
  AnalysisResult,
  ColumnId,
  SectionId,
} from "../types.js";
import type { OutputProfileConfig } from "../config/schema.js";
import {
  NULL_PLACEHOLDER,
  COLUMN_HEADERS,
  fmtDate,
  fmtDistance,
  fmtDuration,
  fmtPace,
  fmtPower,
  fmtHR,
  fmtHRpctLTHR,
  fmtLSS,
  fmtBalance,
  fmtGCT,
  fmtStride,
  fmtVO,
  fmtFPR,
  fmtVR,
  fmtZonePct,
  fmtElevation,
  fmtElevationSigned,
  fmtTemperature,
  fmtHumidity,
  fmtWind,
  fmtIF,
  fmtRSS,
  renderColumnValue,
  padTable,
} from "./utils.js";
import { renderElevationChart } from "./ascii-chart.js";

// ---------------------------------------------------------------------------
// Internal types (re-uses optional fields from FilteredAnalysisResult)
// ---------------------------------------------------------------------------

type FilteredResult = Pick<
  AnalysisResult,
  "metadata" | "capabilities"
> & Partial<Omit<AnalysisResult, "metadata" | "capabilities">>;

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderMetadata(result: FilteredResult): string {
  const { version, downsample, anomaliesExcluded, fileSampleRate } = result.metadata;
  const dsStr = downsample != null ? `${downsample}s` : "none";
  const sampleStr = fileSampleRate != null ? `${fileSampleRate}s` : "unknown";
  const anomStr = anomaliesExcluded ? "excluded" : "included";
  return [
    "## Metadata",
    "",
    `Produced by: run2max v${version}`,
    `Downsample: ${dsStr} | File sample rate: ${sampleStr}`,
    `Anomalies: ${anomStr}`,
  ].join("\n");
}

function renderSummary(result: FilteredResult): string {
  const s = result.summary;
  if (!s) return "";

  const lines: string[] = ["## Run Summary", ""];

  // Date line
  lines.push(`Date: ${fmtDate(s.date, s.timezone)}`);

  // Context lines (only if present)
  const contextParts: string[] = [];
  if (s.workout) contextParts.push(`Workout: ${s.workout}`);
  if (s.block)   contextParts.push(`Block: ${s.block}`);
  if (s.rpe != null) contextParts.push(`RPE: ${s.rpe}`);
  if (contextParts.length > 0) lines.push(contextParts.join(" | "));
  if (s.notes) lines.push(`Notes: ${s.notes}`);

  // Distance / duration
  lines.push(
    `Distance: ${fmtDistance(s.distance)} | Duration: ${fmtDuration(s.duration)} | Moving Time: ${fmtDuration(s.movingTime)}`
  );

  // Stats line
  const powerStr = s.avgPower != null
    ? `${fmtPower(s.avgPower)}${s.avgPowerZone ? ` (${s.avgPowerZone})` : ""}`
    : NULL_PLACEHOLDER;

  const hrParts: string[] = [];
  if (s.avgHeartRate != null) hrParts.push(fmtHR(s.avgHeartRate));
  if (s.avgHeartRatePctLthr != null) hrParts.push(fmtHRpctLTHR(s.avgHeartRatePctLthr));
  const hrStr = hrParts.length > 0 ? hrParts.join(" (") + (hrParts.length > 1 ? ")" : "") : NULL_PLACEHOLDER;

  const paceStr = s.avgPace != null ? fmtPace(s.avgPace) : NULL_PLACEHOLDER;

  lines.push(`Avg Power: ${powerStr} | Avg HR: ${hrStr} | Avg Pace: ${paceStr}`);

  // Max values line (only if any are non-null)
  const maxParts: string[] = [];
  if (s.maxPower != null)     maxParts.push(`Max Power: ${fmtPower(s.maxPower)}`);
  if (s.maxHeartRate != null) maxParts.push(`Max HR: ${fmtHR(s.maxHeartRate)}`);
  if (s.maxPace != null)      maxParts.push(`Max Pace: ${fmtPace(s.maxPace)}`);
  if (maxParts.length > 0) lines.push(maxParts.join(" | "));

  // Elevation line (only if any elevation data)
  const elevParts: string[] = [];
  if (s.totalAscent != null)  elevParts.push(`Gain: ${fmtElevation(s.totalAscent)}`);
  if (s.totalDescent != null) elevParts.push(`Loss: ${fmtElevation(s.totalDescent)}`);
  if (s.netElevation != null) elevParts.push(`Net: ${fmtElevationSigned(s.netElevation)}`);
  if (s.minAltitude != null && s.maxAltitude != null)
    elevParts.push(`Alt: ${fmtElevation(s.minAltitude)}–${fmtElevation(s.maxAltitude)}`);
  if (elevParts.length > 0) lines.push(elevParts.join(" | "));

  // Zone labels
  const zoneParts: string[] = [];
  if (s.avgHrZone != null)   zoneParts.push(`Avg HR Zone: ${s.avgHrZone}`);
  if (s.avgPaceZone != null) zoneParts.push(`Avg Pace Zone: ${s.avgPaceZone}`);
  if (zoneParts.length > 0) lines.push(zoneParts.join(" | "));

  // NP / IF / RSS
  const npParts: string[] = [];
  if (s.normalizedPower != null)  npParts.push(`NP: ${fmtPower(s.normalizedPower)}`);
  if (s.intensityFactor != null)  npParts.push(`IF: ${fmtIF(s.intensityFactor)}`);
  if (s.runStressScore != null)   npParts.push(`RSS (r2m): ${fmtRSS(s.runStressScore)}`);
  if (npParts.length > 0) lines.push(npParts.join(" | "));

  return lines.join("\n");
}

function renderSegments(result: FilteredResult, activeColumns: ColumnId[]): string {
  const segments = result.segments;
  if (!segments || segments.length === 0) return "";

  const headers = [
    "Split",
    "Distance",
    "Duration",
    ...activeColumns.map(c => COLUMN_HEADERS[c]),
  ];

  const rows = segments.map(seg => {
    const row = seg as unknown as Record<string, unknown>;
    return [
      `Split ${(seg.lapIndex + 1)}`,
      fmtDistance(seg.distance),
      fmtDuration(seg.duration),
      ...activeColumns.map(c => renderColumnValue(c, row)),
    ];
  });

  return ["## Workout Splits", "", padTable(headers, rows)].join("\n");
}

function renderKmSplits(result: FilteredResult, activeColumns: ColumnId[]): string {
  const splits = result.kmSplits;
  if (!splits || splits.length === 0) return "";

  const headers = [
    "KM",
    "Distance",
    "Duration",
    ...activeColumns.map(c => COLUMN_HEADERS[c]),
  ];

  const rows = splits.map(split => {
    const row = split as unknown as Record<string, unknown>;
    return [
      String(split.km),
      fmtDistance(split.distance),
      fmtDuration(split.duration),
      ...activeColumns.map(c => renderColumnValue(c, row)),
    ];
  });

  return ["## Kilometer Splits", "", padTable(headers, rows)].join("\n");
}

function renderZones(result: FilteredResult): string {
  const zones = result.zoneDistribution;
  if (!zones || zones.length === 0) return "";

  const nonZero = zones.filter(z => z.percentage > 0);
  if (nonZero.length === 0) return "";

  const headers = ["Zone", "Time", "%"];
  const rows = nonZero.map(z => [
    `${z.label} (${z.name})`,
    fmtDuration(z.seconds),
    fmtZonePct(z.percentage),
  ]);

  return ["## Zone Distribution", "", padTable(headers, rows)].join("\n");
}

function renderDynamics(result: FilteredResult): string {
  const d = result.dynamicsSummary;
  if (!d) return "";

  const lines: string[] = ["## Running Dynamics", ""];

  // Tier 2a: GCT
  const t2a: string[] = [];
  if (d.avgStanceTime != null)        t2a.push(`Avg GCT: ${fmtGCT(d.avgStanceTime)}`);
  if (d.avgStanceTimeBalance != null) t2a.push(`GCT Balance: ${fmtBalance(d.avgStanceTimeBalance)}`);
  if (t2a.length > 0) lines.push(t2a.join(" | "));

  // Tier 2b: Stride, VO, VO Balance
  const t2b: string[] = [];
  if (d.avgStepLength != null)                  t2b.push(`Avg Stride: ${fmtStride(d.avgStepLength)}`);
  if (d.avgVerticalOscillation != null)         t2b.push(`Avg VO: ${fmtVO(d.avgVerticalOscillation)}`);
  if (d.avgVerticalOscillationBalance != null)  t2b.push(`VO Balance: ${fmtBalance(d.avgVerticalOscillationBalance)}`);
  if (t2b.length > 0) lines.push(t2b.join(" | "));

  // Tier 3a: Form Power, Air Power, FPR
  const t3a: string[] = [];
  if (d.avgFormPower != null)        t3a.push(`Avg Form Power: ${fmtPower(d.avgFormPower)}`);
  if (d.avgAirPower != null)         t3a.push(`Avg Air Power: ${fmtPower(d.avgAirPower)}`);
  if (d.avgFormPowerRatio != null)   t3a.push(`FPR: ${fmtFPR(d.avgFormPowerRatio)}`);
  if (t3a.length > 0) lines.push(t3a.join(" | "));

  // Tier 3b: LSS, LSS Balance, VR
  const t3b: string[] = [];
  if (d.avgLegSpringStiffness != null)        t3b.push(`Avg LSS: ${fmtLSS(d.avgLegSpringStiffness)}`);
  if (d.avgLegSpringStiffnessBalance != null) t3b.push(`LSS Balance: ${fmtBalance(d.avgLegSpringStiffnessBalance)}`);
  if (d.avgVerticalRatio != null)             t3b.push(`VR: ${fmtVR(d.avgVerticalRatio)}`);
  if (t3b.length > 0) lines.push(t3b.join(" | "));

  return lines.join("\n");
}

function renderElevationProfile(result: FilteredResult): string {
  const ep = result.elevationProfile;
  if (!ep) return "";

  const statParts = [
    `Gain: ${fmtElevation(ep.totalAscent)}`,
    `Loss: ${fmtElevation(ep.totalDescent)}`,
    `Net: ${fmtElevationSigned(ep.netElevation)}`,
    `Alt: ${fmtElevation(ep.minAltitude)}–${fmtElevation(ep.maxAltitude)}`,
  ];

  return [
    "## Elevation Profile",
    "",
    statParts.join(" | "),
    "",
    "```",
    renderElevationChart(ep.points),
    "```",
  ].join("\n");
}

function renderWeather(result: FilteredResult): string {
  const w = result.weatherSummary;
  if (!w) return "";

  return [
    "## Weather",
    "",
    [
      `Temp: ${fmtTemperature(w.temperature)}`,
      `Humidity: ${fmtHumidity(w.humidity)}`,
      `Dew Point: ${fmtTemperature(w.dewPoint)}`,
    ].join(" | "),
    [
      `Wind: ${fmtWind(w.windSpeed, w.windDirection)}`,
      `Conditions: ${w.conditions}`,
    ].join(" | "),
  ].join("\n");
}

function renderHrZones(result: FilteredResult): string {
  const zones = result.hrZoneDistribution;
  if (!zones || zones.length === 0) return "";

  const nonZero = zones.filter(z => z.percentage > 0);
  if (nonZero.length === 0) return "";

  const headers = ["Zone", "Time", "%"];
  const rows = nonZero.map(z => [
    `${z.label} (${z.name})`,
    fmtDuration(z.seconds),
    fmtZonePct(z.percentage),
  ]);

  return ["## HR Zone Distribution", "", padTable(headers, rows)].join("\n");
}

function renderPaceZones(result: FilteredResult): string {
  const zones = result.paceZoneDistribution;
  if (!zones || zones.length === 0) return "";

  const nonZero = zones.filter(z => z.percentage > 0);
  if (nonZero.length === 0) return "";

  const headers = ["Zone", "Time", "%"];
  const rows = nonZero.map(z => [
    `${z.label} (${z.name})`,
    fmtDuration(z.seconds),
    fmtZonePct(z.percentage),
  ]);

  return ["## Pace Zone Distribution", "", padTable(headers, rows)].join("\n");
}

function renderAnomalies(result: FilteredResult): string {
  const anomalies = result.anomalies;
  if (!anomalies || anomalies.length === 0) return "";

  const items = anomalies.map(a => {
    const prefix = a.excluded ? "[EXCLUDED FROM STATS] " : "";
    return `- ${prefix}${a.description}`;
  });

  return ["## Anomalies", "", ...items].join("\n");
}

// ---------------------------------------------------------------------------
// Section dispatch
// ---------------------------------------------------------------------------

const SECTION_RENDERERS: Record<
  SectionId,
  (result: FilteredResult, activeColumns: ColumnId[]) => string
> = {
  summary:           (r) => renderSummary(r),
  elevation_profile: (r) => renderElevationProfile(r),
  weather:           (r) => renderWeather(r),
  segments:          (r, cols) => renderSegments(r, cols),
  km_splits:         (r, cols) => renderKmSplits(r, cols),
  zones:             (r) => renderZones(r),
  hr_zones:          (r) => renderHrZones(r),
  pace_zones:        (r) => renderPaceZones(r),
  dynamics:          (r) => renderDynamics(r),
  anomalies:         (r) => renderAnomalies(r),
  metadata:          (r) => renderMetadata(r),
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function formatMarkdown(
  filtered: FilteredResult,
  activeSections: SectionId[],
  activeColumns: ColumnId[],
): string {
  const parts: string[] = [];

  for (const section of activeSections) {
    const rendered = SECTION_RENDERERS[section](filtered, activeColumns);
    if (rendered) parts.push(rendered);
  }

  return parts.join("\n\n");
}
