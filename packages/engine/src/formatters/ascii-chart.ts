// ---------------------------------------------------------------------------
// Box-drawing characters used for the elevation line
// ---------------------------------------------------------------------------

const H  = "─";   // horizontal
const V  = "│";   // vertical
const TL = "╭";   // top-left  (comes from below, goes right)
const TR = "╮";   // top-right (comes from left, goes down)
const BL = "╰";   // bottom-left  (comes from above, goes right)
const BR = "╯";   // bottom-right (comes from left, goes up)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render an ASCII elevation profile chart.
 *
 * @param points  Array of [distanceKm, altitudeM] data points.
 * @param options Optional width (default 60) and height (default 12) in chars.
 * @returns       Multi-line string ready to embed in a Markdown code block.
 */
export function renderElevationChart(
  points: [number, number][],
  options?: { width?: number; height?: number },
): string {
  if (points.length === 0) return "";

  const W = options?.width  ?? 60;
  const H_ROWS = options?.height ?? 12;

  // ── altitude range ────────────────────────────────────────────────────────
  const altitudes = points.map(([, a]) => a);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const altRange = maxAlt - minAlt;

  // For a flat course keep a minimal y-range so math stays defined
  const yMin = altRange < 1 ? minAlt - 0.5 : minAlt;
  const yMax = altRange < 1 ? maxAlt + 0.5 : maxAlt;
  const yRange = yMax - yMin;

  // ── map altitude → row (row 0 = top = highest) ───────────────────────────
  function altToRow(alt: number): number {
    return Math.max(0, Math.min(H_ROWS - 1,
      Math.round(((yMax - alt) / yRange) * (H_ROWS - 1))
    ));
  }

  // ── sample altitude at each column via linear interpolation ───────────────
  const minDist = points[0]![0];
  const maxDist = points[points.length - 1]![0];
  const distRange = maxDist - minDist;

  function sampleAlt(col: number): number {
    if (points.length === 1 || distRange === 0) return (minAlt + maxAlt) / 2;
    const target = minDist + (col / (W - 1)) * distRange;
    // Binary search for surrounding points
    let lo = 0, hi = points.length - 1;
    if (target <= points[lo]![0]) return points[lo]![1];
    if (target >= points[hi]![0]) return points[hi]![1];
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid]![0] <= target) lo = mid; else hi = mid;
    }
    const [d0, a0] = points[lo]!;
    const [d1, a1] = points[hi]!;
    const t = (target - d0) / (d1 - d0);
    return a0 + t * (a1 - a0);
  }

  // ── compute which row each column maps to ────────────────────────────────
  const rows: number[] = Array.from({ length: W }, (_, x) => altToRow(sampleAlt(x)));

  // ── build the 2D grid (H_ROWS × W, filled with spaces) ───────────────────
  const grid: string[][] = Array.from({ length: H_ROWS }, () => Array(W).fill(" "));

  function set(row: number, col: number, ch: string): void {
    if (row >= 0 && row < H_ROWS && col >= 0 && col < W) grid[row]![col] = ch;
  }

  // Process each column based on the transition to the next column
  for (let x = 0; x < W - 1; x++) {
    const curr = rows[x]!;
    const next = rows[x + 1]!;

    if (curr === next) {
      set(curr, x, H);
    } else if (curr > next) {
      // Altitude increases left→right (row index decreases = visually goes up)
      set(curr, x, BR);
      for (let r = next + 1; r < curr; r++) set(r, x, V);
      set(next, x, TL);
    } else {
      // Altitude decreases left→right (row index increases = visually goes down)
      set(curr, x, TR);
      for (let r = curr + 1; r < next; r++) set(r, x, V);
      set(next, x, BL);
    }
  }
  // Last column: just a horizontal cap
  set(rows[W - 1]!, W - 1, H);

  // ── y-axis labels (one per row) ───────────────────────────────────────────
  const yLabels: string[] = Array.from({ length: H_ROWS }, (_, r) => {
    const alt = yMax - (r / (H_ROWS - 1)) * yRange;
    return `${Math.round(alt)} m`;
  });
  const yLabelWidth = Math.max(...yLabels.map(l => l.length));

  // ── assemble output lines ─────────────────────────────────────────────────
  const out: string[] = [];

  // Chart rows
  for (let r = 0; r < H_ROWS; r++) {
    const label = yLabels[r]!.padStart(yLabelWidth);
    out.push(`${label} ┤${grid[r]!.join("")}`);
  }

  // X-axis bottom line: yLabelWidth spaces + " └" + W × "─"
  out.push(`${" ".repeat(yLabelWidth)} └${"─".repeat(W)}`);

  // X-axis distance labels
  // prefixLen = yLabelWidth + 2 chars (" └") = same horizontal offset as content
  const prefixLen = yLabelWidth + 2;
  out.push(buildXAxisLabels(minDist, maxDist, W, prefixLen));

  return out.join("\n");
}

// ---------------------------------------------------------------------------
// X-axis label builder
// ---------------------------------------------------------------------------

function buildXAxisLabels(
  minDist: number,
  maxDist: number,
  W: number,
  prefixLen: number,
): string {
  const totalKm = maxDist - minDist;
  const interval = chooseInterval(totalKm, W);

  // Collect (contentColumn, labelString) pairs
  const entries: [number, string][] = [];

  if (totalKm === 0) {
    entries.push([0, formatKm(minDist)]);
  } else {
    // First label at or after minDist
    const firstKm = Math.ceil((minDist + 1e-9) / interval) * interval;
    // Include 0/minDist if it's the start
    if (minDist === 0) entries.push([0, "0"]);

    for (let km = firstKm; km <= maxDist + 1e-9; km = roundKm(km + interval)) {
      const col = Math.round(((km - minDist) / totalKm) * (W - 1));
      entries.push([col, formatKm(km)]);
    }
  }

  // Build character array: prefixLen + W + a few extra for "km"
  const totalLen = prefixLen + W + 4;
  const chars: string[] = Array(totalLen).fill(" ");

  for (const [col, lbl] of entries) {
    const start = prefixLen + col - Math.floor(lbl.length / 2);
    for (let i = 0; i < lbl.length; i++) {
      const pos = start + i;
      if (pos >= 0 && pos < chars.length) chars[pos] = lbl[i]!;
    }
  }

  // "km" suffix just after the last column
  const kmPos = prefixLen + W + 1;
  if (kmPos + 1 < chars.length) {
    chars[kmPos]     = "k";
    chars[kmPos + 1] = "m";
  }

  return chars.join("").trimEnd();
}

/** Choose a round-number km interval so we get ~4–8 labels in width chars. */
function chooseInterval(totalKm: number, W: number): number {
  const targetLabels = Math.max(4, Math.min(8, Math.floor(W / 8)));
  const raw = totalKm / targetLabels;
  for (const n of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]) {
    if (n >= raw) return n;
  }
  return 100;
}

function formatKm(km: number): string {
  const r = Math.round(km * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Avoid floating-point drift when stepping through intervals. */
function roundKm(km: number): number {
  return Math.round(km * 10000) / 10000;
}
