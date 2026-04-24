import type { AnalysisResult, ColumnId, SegmentRow, KmSplitRow } from "../types.js";
import { COLUMN_FIELD_MAP } from "./utils.js";

type FilteredResult = Pick<
  AnalysisResult,
  "metadata" | "capabilities"
> & Partial<Omit<AnalysisResult, "metadata" | "capabilities">>;

const SEGMENT_IDENTITY = ["lapIndex", "distance", "duration"] as const;
const KM_IDENTITY = ["km", "distance", "duration"] as const;

function filterSegmentRow(
  row: SegmentRow,
  activeColumns: ColumnId[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of SEGMENT_IDENTITY) result[key] = row[key];
  for (const col of activeColumns) {
    const field = COLUMN_FIELD_MAP[col];
    result[field] = (row as unknown as Record<string, unknown>)[field] ?? null;
  }
  return result;
}

function filterKmRow(
  row: KmSplitRow,
  activeColumns: ColumnId[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of KM_IDENTITY) result[key] = row[key];
  for (const col of activeColumns) {
    const field = COLUMN_FIELD_MAP[col];
    result[field] = (row as unknown as Record<string, unknown>)[field] ?? null;
  }
  return result;
}

export function formatJson(
  filtered: FilteredResult,
  activeColumns: ColumnId[],
): string {
  const out: Record<string, unknown> = { metadata: filtered.metadata };

  if (filtered.summary !== undefined)          out["summary"] = filtered.summary;
  if (filtered.elevationProfile !== undefined) out["elevationProfile"] = filtered.elevationProfile;
  if (filtered.weatherSummary !== undefined)   out["weatherSummary"] = filtered.weatherSummary;
  if (filtered.segments !== undefined)         out["segments"] = filtered.segments.map(r => filterSegmentRow(r, activeColumns));
  if (filtered.kmSplits !== undefined)         out["kmSplits"] = filtered.kmSplits.map(r => filterKmRow(r, activeColumns));
  if (filtered.zoneDistribution !== undefined)     out["zoneDistribution"] = filtered.zoneDistribution;
  if (filtered.hrZoneDistribution !== undefined)   out["hrZoneDistribution"] = filtered.hrZoneDistribution;
  if (filtered.paceZoneDistribution !== undefined) out["paceZoneDistribution"] = filtered.paceZoneDistribution;
  if (filtered.dynamicsSummary !== undefined)  out["dynamicsSummary"] = filtered.dynamicsSummary;
  if (filtered.anomalies !== undefined)        out["anomalies"] = filtered.anomalies;

  return JSON.stringify(out, null, 2);
}
