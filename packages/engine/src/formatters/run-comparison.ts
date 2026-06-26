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

// Rounding/sign-normalization policy.
//
// The engine emits exact raw numbers, but the formatter rounds them for
// display. A delta rendered straight off the raw numbers can contradict the
// rounded absolutes it sits next to (e.g. absolutes that both render "0 C"
// showing a "+1 C" delta, or a "−0 C" delta). To keep the rendered report
// internally consistent, every delta is computed from the *displayed* values:
//
//   delta = display(comparand) − display(baseline)
//
// where `display` quantizes a raw value to the same resolution its absolute
// formatter shows. This makes two guarantees fall out by construction:
//   1. equal rounded absolutes always show a zero delta (and vice versa), and
//   2. a delta whose magnitude rounds to zero is rendered without a sign
//      (no "+0", no "−0 C").

interface MetricRow {
  label: string;
  abs: AbsFmt;
  /** Quantize a raw value to the resolution its absolute is displayed at. */
  display: (v: number) => number;
  /** Render a delta already quantized to display resolution. */
  delta: DeltaFmt;
}

function sign(n: number): string {
  return n < 0 ? "−" : "+";
}

/** Round-to-base-unit display (W, bpm, C, %, m, seconds). */
function roundDisplay(v: number): number {
  return Math.round(v);
}

/** Distance is displayed in km to two decimals. */
function kmDisplay(v: number): number {
  return Number((v / 1000).toFixed(2));
}

/** Fixed-decimal delta in `unit`; sign suppressed when the magnitude is zero. */
function deltaFixed(unit: string, decimals = 0): DeltaFmt {
  return (v) => {
    const mag = Math.abs(v).toFixed(decimals);
    return Number(mag) === 0 ? `0${unit}` : `${sign(v)}${mag}${unit}`;
  };
}

/** `±M:SS` delta from a seconds value; sign suppressed at 0:00. */
function deltaTime(v: number): string {
  const total = Math.round(Math.abs(v));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const mag = `${m}:${String(s).padStart(2, "0")}`;
  return total === 0 ? mag : `${sign(v)}${mag}`;
}

/** Distance delta; `v` is already in km. Sign suppressed when it rounds to 0.00. */
function deltaKm(v: number): string {
  const mag = Math.abs(v).toFixed(2);
  return Number(mag) === 0 ? `${mag} km` : `${sign(v)}${mag} km`;
}

/** RPE delta; RPE is integer-valued, displayed unrounded. Sign suppressed at 0. */
function deltaRpe(v: number): string {
  return v === 0 ? "0" : `${sign(v)}${Math.abs(v)}`;
}

const PERFORMANCE_ROWS: Record<string, MetricRow> = {
  duration: { label: "Duration", abs: fmtDuration, display: roundDisplay, delta: deltaTime },
  distance: { label: "Distance", abs: fmtDistance, display: kmDisplay, delta: deltaKm },
  avgPower: { label: "Avg Power", abs: fmtPower, display: roundDisplay, delta: deltaFixed(" W") },
  avgHeartRate: { label: "Avg HR", abs: fmtHR, display: roundDisplay, delta: deltaFixed(" bpm") },
  maxHeartRate: { label: "Max HR", abs: fmtHR, display: roundDisplay, delta: deltaFixed(" bpm") },
  avgPace: { label: "Avg Pace", abs: fmtPace, display: roundDisplay, delta: (v) => `${deltaTime(v)}/km` },
  rpe: { label: "RPE", abs: (v) => String(v), display: (v) => v, delta: deltaRpe },
};

const CONDITIONS_ROWS: Record<string, MetricRow> = {
  temperature: { label: "Temperature", abs: fmtTemperature, display: roundDisplay, delta: deltaFixed(" C") },
  windSpeed: { label: "Wind Speed", abs: (v) => `${Math.round(v)} km/h`, display: roundDisplay, delta: deltaFixed(" km/h") },
  totalAscent: { label: "Total Ascent", abs: fmtElevation, display: roundDisplay, delta: deltaFixed(" m") },
  humidity: { label: "Humidity", abs: fmtHumidity, display: roundDisplay, delta: deltaFixed(" %") },
  dewPoint: { label: "Dew Point", abs: fmtTemperature, display: roundDisplay, delta: deltaFixed(" C") },
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
    const display = row?.display ?? ((v: number) => v);
    const deltaFmt = row?.delta ?? ((v: number) => String(v));
    // Delta is derived from the *displayed* values so it can never contradict
    // the rounded absolutes shown beside it.
    const delta = display(d.comparand) - display(d.baseline);
    return [label, absFmt(d.baseline), absFmt(d.comparand), deltaFmt(delta)];
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
