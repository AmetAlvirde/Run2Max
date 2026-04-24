import type { ColumnId, DataCapabilities } from "../types.js";

// ---------------------------------------------------------------------------
// Null placeholder
// ---------------------------------------------------------------------------

export const NULL_PLACEHOLDER = "--";

// ---------------------------------------------------------------------------
// Column metadata
// ---------------------------------------------------------------------------

export const COLUMN_HEADERS: Record<ColumnId, string> = {
  power:       "Power",
  zone:        "Zone",
  pace:        "Pace",
  hr:          "HR",
  cadence:     "Cadence",
  gct:         "GCT",
  gct_balance: "GCT Bal",
  stride:      "Stride",
  vo:          "VO",
  vo_balance:  "VO Bal",
  fpr:         "FPR",
  vr:          "VR",
};

/** Which DataCapabilities flag a column requires. Undefined = always available. */
export const TIER_REQUIREMENTS: Partial<Record<ColumnId, keyof DataCapabilities>> = {
  gct:         "hasRunningDynamics",
  gct_balance: "hasRunningDynamics",
  stride:      "hasRunningDynamics",
  vo:          "hasRunningDynamics",
  vo_balance:  "hasRunningDynamics",
  vr:          "hasRunningDynamics",
  fpr:         "hasStrydEnhanced",
};

/** Maps ColumnId to the field name on SegmentRow / KmSplitRow. */
export const COLUMN_FIELD_MAP: Record<ColumnId, string> = {
  power:       "avgPower",
  zone:        "zone",
  pace:        "avgPace",
  hr:          "avgHeartRate",
  cadence:     "avgCadence",
  gct:         "avgStanceTime",
  gct_balance: "avgStanceTimeBalance",
  stride:      "avgStepLength",
  vo:          "avgVerticalOscillation",
  vo_balance:  "avgVerticalOscillationBalance",
  fpr:         "formPowerRatio",
  vr:          "verticalRatio",
};

// ---------------------------------------------------------------------------
// Unit formatters
// ---------------------------------------------------------------------------

export function fmtDistance(m: number): string {
  return `${(m / 1000).toFixed(2)} km`;
}

export function fmtDuration(s: number): string {
  const totalSec = Math.round(s);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return `${h}:${mm}:${ss}`;
}

export function fmtPace(secPerKm: number): string {
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}/km`;
}

export function fmtPower(w: number): string {
  return `${Math.round(w)} W`;
}

export function fmtHR(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

export function fmtHRpctLTHR(pct: number): string {
  return `${pct.toFixed(1)} % LTHR`;
}

export function fmtCadence(spm: number): string {
  return `${Math.round(spm)} spm`;
}

export function fmtGCT(ms: number): string {
  return `${Math.round(ms)} ms`;
}

export function fmtBalance(pct: number): string {
  return `${pct.toFixed(1)} %`;
}

/** stepLength is stored in mm; renders as m */
export function fmtStride(mm: number): string {
  return `${(mm / 1000).toFixed(2)} m`;
}

export function fmtVO(mm: number): string {
  return `${Math.round(mm)} mm`;
}

export function fmtLSS(kNm: number): string {
  return `${kNm.toFixed(1)} kN/m`;
}

export function fmtFPR(ratio: number): string {
  return ratio.toFixed(2);
}

export function fmtVR(pct: number): string {
  return `${pct.toFixed(1)} %`;
}

export function fmtZonePct(pct: number): string {
  return `${pct.toFixed(1)} %`;
}

/** Format a Date in the given IANA timezone. */
export function fmtDate(date: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")} ${get("hour")}:${get("minute")} (${timezone})`;
}

// ---------------------------------------------------------------------------
// Column value renderer (used by markdown row cells)
// ---------------------------------------------------------------------------

export function renderColumnValue(
  col: ColumnId,
  row: Record<string, unknown>,
): string {
  const field = COLUMN_FIELD_MAP[col];
  const value = row[field];
  if (value === null || value === undefined) return NULL_PLACEHOLDER;
  if (col === "zone") return String(value);
  const n = value as number;
  switch (col) {
    case "power":       return fmtPower(n);
    case "pace":        return fmtPace(n);
    case "hr":          return fmtHR(n);
    case "cadence":     return fmtCadence(n);
    case "gct":         return fmtGCT(n);
    case "gct_balance": return fmtBalance(n);
    case "stride":      return fmtStride(n);
    case "vo":          return fmtVO(n);
    case "vo_balance":  return fmtBalance(n);
    case "fpr":         return fmtFPR(n);
    case "vr":          return fmtVR(n);
    default:            return String(value);
  }
}

// ---------------------------------------------------------------------------
// Pipe table builder
// ---------------------------------------------------------------------------

/**
 * Builds a padded markdown pipe table.
 * First column is left-aligned; all others are right-aligned.
 */
export function padTable(headers: string[], rows: string[][]): string {
  const allRows = [headers, ...rows];
  const colWidths = headers.map((_, colIdx) =>
    Math.max(...allRows.map(row => (row[colIdx] ?? "").length), 3)
  );

  const padCell = (s: string, width: number, isFirst: boolean) =>
    isFirst ? s.padEnd(width) : s.padStart(width);

  const renderRow = (cells: string[]) =>
    "| " +
    cells.map((cell, i) => padCell(cell, colWidths[i]!, i === 0)).join(" | ") +
    " |";

  const separator =
    "| " +
    colWidths
      .map((w, i) =>
        i === 0
          ? ":" + "-".repeat(w - 1)
          : "-".repeat(w - 1) + ":"
      )
      .join(" | ") +
    " |";

  return [renderRow(headers), separator, ...rows.map(renderRow)].join("\n");
}

// ---------------------------------------------------------------------------
// camelCase → snake_case (recursive, for YAML output)
// ---------------------------------------------------------------------------

export function camelToSnake(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelToSnake);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k.replace(/([A-Z])/g, "_$1").toLowerCase(),
        camelToSnake(v),
      ])
    );
  }
  return value;
}
