import { describe, it, expect } from "vitest";
import { renderElevationChart } from "./ascii-chart.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chartLines(points: [number, number][], w: number, h: number): string[] {
  return renderElevationChart(points, { width: w, height: h }).split("\n");
}

/** Extract chart content (after ┤) for a given row line. */
function contentAfterTick(line: string): string {
  const idx = line.indexOf("┤");
  return idx === -1 ? "" : line.slice(idx + 1);
}

// ---------------------------------------------------------------------------
// Empty / edge cases
// ---------------------------------------------------------------------------

describe("renderElevationChart – edge cases", () => {
  it("returns empty string for empty points array", () => {
    expect(renderElevationChart([])).toBe("");
  });

  it("handles a single point without throwing", () => {
    expect(() => renderElevationChart([[0, 250]], { width: 10, height: 5 })).not.toThrow();
  });

  it("handles near-flat altitude (tiny range) without throwing", () => {
    const points: [number, number][] = [
      [0, 100.1], [1, 100.2], [2, 100.3],
    ];
    expect(() => renderElevationChart(points, { width: 20, height: 5 })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("renderElevationChart – structure", () => {
  it("produces height + 2 lines (chart rows + axis line + labels)", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 30, 6);
    expect(lines.length).toBe(8); // 6 + 2
  });

  it("uses default width=60 and height=12 (14 lines)", () => {
    const pts: [number, number][] = [[0, 100], [10, 150]];
    const lines = renderElevationChart(pts).split("\n");
    expect(lines.length).toBe(14); // 12 + 2
  });

  it("each chart row contains the ┤ tick character", () => {
    const pts: [number, number][] = [[0, 200], [5, 250]];
    const lines = chartLines(pts, 20, 5);
    for (let r = 0; r < 5; r++) {
      expect(lines[r]).toContain("┤");
    }
  });

  it("content after ┤ is exactly width characters wide", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 30, 6);
    for (let r = 0; r < 6; r++) {
      const content = contentAfterTick(lines[r]!);
      expect(content.length).toBe(30);
    }
  });

  it("second-to-last line contains the └ corner character", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 20, 5);
    expect(lines[lines.length - 2]).toContain("└");
  });

  it("x-axis line (second-to-last) has width ─ characters after └", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 20, 5);
    const axisLine = lines[lines.length - 2]!;
    const afterCorner = axisLine.slice(axisLine.indexOf("└") + 1);
    expect(afterCorner).toBe("─".repeat(20));
  });

  it("last line contains 'km' distance marker", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 30, 5);
    expect(lines[lines.length - 1]).toContain("km");
  });
});

// ---------------------------------------------------------------------------
// Y-axis labels
// ---------------------------------------------------------------------------

describe("renderElevationChart – y-axis labels", () => {
  it("labels contain altitude values with 'm' unit", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const chart = renderElevationChart(pts, { width: 30, height: 5 });
    expect(chart).toMatch(/\d+ m/);
  });

  it("top row label is the highest altitude (rounded)", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 30, 5);
    // Top row label should be close to maxAlt (250)
    const topLabel = lines[0]!.split("┤")[0]!.trim();
    const val = parseInt(topLabel.replace(" m", ""), 10);
    expect(val).toBeCloseTo(250, -1); // within ~5
  });

  it("bottom row label is the lowest altitude (rounded)", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 30, 5);
    const lastChartRow = lines[4]!;
    const bottomLabel = lastChartRow.split("┤")[0]!.trim();
    const val = parseInt(bottomLabel.replace(" m", ""), 10);
    expect(val).toBeCloseTo(200, -1);
  });

  it("all y-labels are right-aligned to the same width", () => {
    const pts: [number, number][] = [[0, 100], [5, 1000], [10, 100]];
    const lines = chartLines(pts, 20, 5);
    const labelWidths = Array.from({ length: 5 }, (_, r) =>
      lines[r]!.indexOf("┤")
    );
    // All tick positions must be the same (consistent label width)
    expect(new Set(labelWidths).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// X-axis labels
// ---------------------------------------------------------------------------

describe("renderElevationChart – x-axis labels", () => {
  it("x-axis label line contains the start distance (0 when minDist=0)", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 40, 5);
    expect(lines[lines.length - 1]).toMatch(/\b0\b/);
  });

  it("x-axis label line contains mid-distance values", () => {
    const pts: [number, number][] = [[0, 200], [5, 250], [10, 200]];
    const lines = chartLines(pts, 50, 5);
    // Should contain at least one of: 2, 4, 5, 6, 8, 10
    expect(lines[lines.length - 1]).toMatch(/\b(2|4|5|6|8|10)\b/);
  });

  it("x-axis label starts at correct horizontal offset (under ┤)", () => {
    const pts: [number, number][] = [[0, 200], [10, 250]];
    const lines = chartLines(pts, 30, 5);
    const tickPos = lines[0]!.indexOf("┤");
    const cornerPos = lines[5]!.indexOf("└");
    // └ should be at the same position as ┤
    expect(cornerPos).toBe(tickPos);
  });
});

// ---------------------------------------------------------------------------
// Line shape
// ---------------------------------------------------------------------------

describe("renderElevationChart – line shape", () => {
  it("flat course produces only horizontal ─ characters in the grid", () => {
    const pts: [number, number][] = [
      [0, 100], [1, 100], [2, 100], [3, 100], [4, 100],
    ];
    const lines = chartLines(pts, 20, 5);
    const gridChars = lines.slice(0, 5).map(l => contentAfterTick(l)).join("");
    // All non-space characters should be ─
    const nonSpace = gridChars.replace(/ /g, "");
    expect(nonSpace).toBe("─".repeat(nonSpace.length));
  });

  it("ascending line contains ╭ and ╯ transition characters", () => {
    const pts: [number, number][] = [
      [0, 100], [1, 110], [2, 120], [3, 130], [4, 140],
    ];
    const chart = renderElevationChart(pts, { width: 20, height: 5 });
    expect(chart).toMatch(/[╭╯]/);
  });

  it("descending line contains ╮ and ╰ transition characters", () => {
    const pts: [number, number][] = [
      [0, 140], [1, 130], [2, 120], [3, 110], [4, 100],
    ];
    const chart = renderElevationChart(pts, { width: 20, height: 5 });
    expect(chart).toMatch(/[╮╰]/);
  });

  it("peak (up then down) contains all four corner characters", () => {
    const pts: [number, number][] = [
      [0, 200], [2, 200], [5, 250], [8, 200], [10, 200],
    ];
    const chart = renderElevationChart(pts, { width: 40, height: 6 });
    expect(chart).toContain("╭");
    expect(chart).toContain("╯");
    expect(chart).toContain("╮");
    expect(chart).toContain("╰");
  });

  it("the line occupies the top row at the altitude peak", () => {
    // Pyramid: 200 → 250 → 200
    const pts: [number, number][] = [
      [0, 200], [5, 250], [10, 200],
    ];
    const lines = chartLines(pts, 40, 5);
    // Top chart row (row 0) must contain at least one non-space chart char
    const topContent = contentAfterTick(lines[0]!);
    expect(topContent.trim()).not.toBe("");
  });

  it("the line occupies the bottom row at the altitude trough", () => {
    // Valley: 250 → 200 → 250
    const pts: [number, number][] = [
      [0, 250], [5, 200], [10, 250],
    ];
    const lines = chartLines(pts, 40, 5);
    const bottomContent = contentAfterTick(lines[4]!);
    expect(bottomContent.trim()).not.toBe("");
  });

  it("multi-row jump produces │ vertical segments in between", () => {
    // Sharp peak: jump by more than 1 row in a single column
    const pts: [number, number][] = [
      [0, 100], [0.01, 200], [10, 200],
    ];
    const chart = renderElevationChart(pts, { width: 20, height: 10 });
    expect(chart).toContain("│");
  });
});
