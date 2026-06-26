// Presentation for Run Comparison. The engine emits raw tagged delta groups;
// this formatter groups them into Performance and Conditions tables and makes
// signs human-legible. Markdown only for now.

import type {
  RunComparison,
  RunComparisonMetricDelta,
} from "../computations/run-comparison.js";
import {
  degreesToCompass16,
  fmtDistance,
  fmtDuration,
  fmtElevation,
  fmtHR,
  fmtHumidity,
  fmtPace,
  fmtPower,
  fmtTemperature,
  padTable,
} from "./utils.js";

type AbsFmt = (v: number) => string;
type DeltaFmt = (v: number) => string;

interface MetricRow {
  label: string;
  abs: AbsFmt;
  delta: DeltaFmt;
}

function sign(n: number): string {
  return n >= 0 ? "+" : "−";
}

function signedUnit(unit: string, decimals = 0): DeltaFmt {
  return (v) => `${sign(v)}${Math.abs(v).toFixed(decimals)}${unit}`;
}

function signedTime(v: number): string {
  const total = Math.round(Math.abs(v));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${sign(v)}${m}:${String(s).padStart(2, "0")}`;
}

function signedKm(v: number): string {
  return `${sign(v)}${(Math.abs(v) / 1000).toFixed(2)} km`;
}

const PERFORMANCE_ROWS: Record<string, MetricRow> = {
  duration: { label: "Duration", abs: fmtDuration, delta: signedTime },
  distance: { label: "Distance", abs: fmtDistance, delta: signedKm },
  avgPower: { label: "Avg Power", abs: fmtPower, delta: signedUnit(" W") },
  avgHeartRate: { label: "Avg HR", abs: fmtHR, delta: signedUnit(" bpm") },
  maxHeartRate: { label: "Max HR", abs: fmtHR, delta: signedUnit(" bpm") },
  avgPace: { label: "Avg Pace", abs: fmtPace, delta: (v) => `${signedTime(v)}/km` },
  rpe: { label: "RPE", abs: (v) => String(v), delta: signedUnit("") },
};

const CONDITIONS_ROWS: Record<string, MetricRow> = {
  temperature: { label: "Temperature", abs: fmtTemperature, delta: signedUnit(" C") },
  windSpeed: { label: "Wind Speed", abs: (v) => `${Math.round(v)} km/h`, delta: signedUnit(" km/h") },
  totalAscent: { label: "Total Ascent", abs: fmtElevation, delta: signedUnit(" m") },
  humidity: { label: "Humidity", abs: fmtHumidity, delta: signedUnit(" %") },
  dewPoint: { label: "Dew Point", abs: fmtTemperature, delta: signedUnit(" C") },
};

const UNAVAILABLE_NOTE: Record<string, string> = {
  missing_baseline_value: "missing baseline",
  missing_comparand_value: "missing comparand",
  missing_both_values: "missing both",
};

function toCells(
  d: RunComparisonMetricDelta<string>,
  rows: Record<string, MetricRow>,
): string[] {
  const row = rows[d.metric];
  const label = row?.label ?? d.metric;
  const absFmt = row?.abs ?? ((v: number) => String(v));

  if (d.status === "available") {
    return [
      label,
      absFmt(d.baseline),
      absFmt(d.comparand),
      (row?.delta ?? String)(d.delta),
    ];
  }

  const b = d.baseline === null ? "—" : absFmt(d.baseline);
  const c = d.comparand === null ? "—" : absFmt(d.comparand);
  return [label, b, c, `n/a (${UNAVAILABLE_NOTE[d.reason]})`];
}

const CONTEXT_LABELS: Record<string, string> = {
  conditions: "Conditions",
  windDirection: "Wind Direction",
};

function fmtContextValue(
  field: string,
  value: string | number | null,
): string {
  if (value === null) return "—";
  if (field === "windDirection" && typeof value === "number") {
    return degreesToCompass16(value);
  }
  return String(value);
}

export function formatRunComparison(comparison: RunComparison): string {
  const lines: string[] = [];
  lines.push("# Run Comparison");
  lines.push("");
  lines.push(`- **Baseline:** ${comparison.baseline.label}`);
  lines.push(`- **Comparand:** ${comparison.comparand.label}`);
  lines.push("");
  lines.push("> delta = comparand − baseline (pace sign unflipped)");
  lines.push("");

  const headers = [
    "Metric",
    comparison.baseline.label,
    comparison.comparand.label,
    "Delta",
  ];

  lines.push("## Performance");
  lines.push("");
  lines.push(
    padTable(
      headers,
      comparison.performance.map((d) => toCells(d, PERFORMANCE_ROWS)),
    ),
  );
  lines.push("");

  const conditionsRows = comparison.conditions.map((d) =>
    toCells(d, CONDITIONS_ROWS),
  );
  for (const ctx of comparison.context) {
    const label = CONTEXT_LABELS[ctx.field] ?? ctx.field;
    conditionsRows.push([
      label,
      fmtContextValue(ctx.field, ctx.baseline),
      fmtContextValue(ctx.field, ctx.comparand),
      "(context only)",
    ]);
  }

  lines.push("## Conditions");
  lines.push("");
  lines.push(padTable(headers, conditionsRows));
  lines.push("");

  return lines.join("\n");
}
