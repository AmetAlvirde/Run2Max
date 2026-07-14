import { describe, expect, it } from "vitest";
import type {
  RunComparison,
  RunComparisonConditionsMetric,
  RunComparisonContextField,
  RunComparisonMetricDelta,
  RunComparisonMetricDeltaAvailable,
  RunComparisonMetricDeltaUnavailable,
  RunComparisonPerformanceMetric,
  RunComparisonUnavailableReason,
} from "../computations/run-comparison.js";
import { degreesToCompass16 } from "./utils.js";
import { formatRunComparison } from "./run-comparison.js";

// Formatter unit tests for Run Comparison. These construct `RunComparison`
// objects directly (no IO): the engine emits raw tagged groups; this slice
// owns presentation correctness — alignment, the unavailable vocabulary,
// context-only rows, compass notation, and the rounding/sign-normalization
// policy that keeps the rendered delta consistent with the rounded absolutes.

function avail<M extends string>(
  metric: M,
  baseline: number,
  comparand: number,
): RunComparisonMetricDeltaAvailable<M> {
  return { metric, status: "available", baseline, comparand, delta: comparand - baseline };
}

function unavail<M extends string>(
  metric: M,
  baseline: number | null,
  comparand: number | null,
  reason: RunComparisonUnavailableReason,
): RunComparisonMetricDeltaUnavailable<M> {
  return { metric, status: "unavailable", baseline, comparand, reason };
}

function comparison(over?: Partial<RunComparison>): RunComparison {
  return {
    baseline: { label: "base" },
    comparand: { label: "cmp" },
    performance: [],
    conditions: [],
    context: [],
    ...over,
  };
}

/** Lines belonging to a markdown pipe table (start with "|"). */
function tableLines(output: string): string[] {
  return output.split("\n").filter((l) => l.startsWith("|"));
}

/** Cells of a given metric/context row, trimmed. */
function rowCells(output: string, label: string): string[] | undefined {
  const line = tableLines(output).find((l) => l.includes(`| ${label} `));
  return line
    ?.slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

describe("formatRunComparison — structure & alignment", () => {
  it("renders the header, sign-convention note, and both section titles", () => {
    const output = formatRunComparison(
      comparison({
        baseline: { label: "morning" },
        comparand: { label: "evening" },
        performance: [avail<RunComparisonPerformanceMetric>("avgPower", 200, 250)],
      }),
    );

    expect(output).toContain("# Run Comparison");
    expect(output).toContain("- **Baseline:** morning");
    expect(output).toContain("- **Comparand:** evening");
    expect(output).toContain("> delta = comparand − baseline (pace sign unflipped)");
    expect(output).toContain("## Performance");
    expect(output).toContain("## Conditions");
  });

  it("names the columns after the actual Runs, not Baseline/Comparand", () => {
    const output = formatRunComparison(
      comparison({
        baseline: { label: "build-26" },
        comparand: { label: "intervals" },
        performance: [avail<RunComparisonPerformanceMetric>("avgPower", 200, 250)],
      }),
    );

    const header = tableLines(output)[0]!;
    expect(header).toContain("build-26");
    expect(header).toContain("intervals");
  });

  it("pads every table row to equal width and emits aligned separators", () => {
    const output = formatRunComparison(
      comparison({
        performance: [
          avail<RunComparisonPerformanceMetric>("avgPower", 200, 250),
          avail<RunComparisonPerformanceMetric>("avgHeartRate", 150, 145),
        ],
      }),
    );

    // Performance is the first table block. Collect its contiguous lines.
    const lines = output.split("\n");
    const start = lines.findIndex((l) => l.startsWith("| Metric"));
    const block: string[] = [];
    for (let i = start; i < lines.length && lines[i]!.startsWith("|"); i++) {
      block.push(lines[i]!);
    }

    // All rows in a padded table share the same rendered width.
    const widths = new Set(block.map((l) => l.length));
    expect(widths.size).toBe(1);

    // Separator: first column left-aligned (`:---`), others right-aligned (`---:`).
    const separator = block[1]!;
    expect(separator).toMatch(/^\| :-+ \| -+: \| -+: \| -+: \|$/);
  });
});

describe("formatRunComparison — available rows", () => {
  it("formats each performance metric in its own units", () => {
    const output = formatRunComparison(
      comparison({
        performance: [
          avail<RunComparisonPerformanceMetric>("duration", 3600, 3720),
          avail<RunComparisonPerformanceMetric>("distance", 10000, 10500),
          avail<RunComparisonPerformanceMetric>("avgPower", 200, 250),
          avail<RunComparisonPerformanceMetric>("avgHeartRate", 150, 145),
          avail<RunComparisonPerformanceMetric>("maxHeartRate", 176, 180),
          avail<RunComparisonPerformanceMetric>("avgPace", 300, 290),
          avail<RunComparisonPerformanceMetric>("rpe", 6, 8),
        ],
      }),
    );

    expect(rowCells(output, "Duration")).toEqual(["Duration", "1:00:00", "1:02:00", "+2:00"]);
    expect(rowCells(output, "Distance")).toEqual(["Distance", "10.00 km", "10.50 km", "+0.50 km"]);
    expect(rowCells(output, "Avg Power")).toEqual(["Avg Power", "200 W", "250 W", "+50 W"]);
    expect(rowCells(output, "Avg HR")).toEqual(["Avg HR", "150 bpm", "145 bpm", "−5 bpm"]);
    expect(rowCells(output, "Max HR")).toEqual(["Max HR", "176 bpm", "180 bpm", "+4 bpm"]);
    expect(rowCells(output, "Avg Pace")).toEqual(["Avg Pace", "5:00/km", "4:50/km", "−0:10/km (faster)"]);
    expect(rowCells(output, "RPE")).toEqual(["RPE", "6", "8", "+2"]);
  });

  it("formats each deltable conditions metric in its own units", () => {
    const output = formatRunComparison(
      comparison({
        conditions: [
          avail<RunComparisonConditionsMetric>("temperature", 12, 15),
          avail<RunComparisonConditionsMetric>("windSpeed", 5, 9),
          avail<RunComparisonConditionsMetric>("totalAscent", 120, 90),
          avail<RunComparisonConditionsMetric>("humidity", 80, 65),
          avail<RunComparisonConditionsMetric>("dewPoint", 8, 8),
        ],
      }),
    );

    expect(rowCells(output, "Temperature")).toEqual(["Temperature", "12 C", "15 C", "+3 C"]);
    expect(rowCells(output, "Wind Speed")).toEqual(["Wind Speed", "5 km/h", "9 km/h", "+4 km/h"]);
    expect(rowCells(output, "Total Ascent")).toEqual(["Total Ascent", "120 m", "90 m", "−30 m"]);
    expect(rowCells(output, "Humidity")).toEqual(["Humidity", "80 %", "65 %", "−15 %"]);
    expect(rowCells(output, "Dew Point")).toEqual(["Dew Point", "8 C", "8 C", "0 C"]);
  });

  it("annotates the pace delta as faster/slower, with no annotation at zero", () => {
    const faster = formatRunComparison(
      comparison({
        performance: [avail<RunComparisonPerformanceMetric>("avgPace", 300, 296)],
      }),
    );
    const slower = formatRunComparison(
      comparison({
        performance: [avail<RunComparisonPerformanceMetric>("avgPace", 300, 305)],
      }),
    );
    const equal = formatRunComparison(
      comparison({
        performance: [avail<RunComparisonPerformanceMetric>("avgPace", 300, 300)],
      }),
    );

    // Negative delta = comparand quicker → "(faster)".
    expect(rowCells(faster, "Avg Pace")).toEqual(["Avg Pace", "5:00/km", "4:56/km", "−0:04/km (faster)"]);
    // Positive delta = comparand slower → "(slower)".
    expect(rowCells(slower, "Avg Pace")).toEqual(["Avg Pace", "5:00/km", "5:05/km", "+0:05/km (slower)"]);
    // Zero delta = no sign, no annotation.
    expect(rowCells(equal, "Avg Pace")).toEqual(["Avg Pace", "5:00/km", "5:00/km", "0:00/km"]);
  });
});

describe("formatRunComparison — unavailable rows", () => {
  it("renders all three unavailable reasons with the missing side shown as —", () => {
    const output = formatRunComparison(
      comparison({
        conditions: [
          unavail<RunComparisonConditionsMetric>("temperature", null, 15, "missing_baseline_value"),
          unavail<RunComparisonConditionsMetric>("windSpeed", 5, null, "missing_comparand_value"),
          unavail<RunComparisonConditionsMetric>("humidity", null, null, "missing_both_values"),
        ],
      }),
    );

    expect(rowCells(output, "Temperature")).toEqual(["Temperature", "—", "15 C", "n/a (missing baseline)"]);
    expect(rowCells(output, "Wind Speed")).toEqual(["Wind Speed", "5 km/h", "—", "n/a (missing comparand)"]);
    expect(rowCells(output, "Humidity")).toEqual(["Humidity", "—", "—", "n/a (missing both)"]);
  });
});

describe("formatRunComparison — context-only rows", () => {
  it("renders conditions text and wind direction as compass point plus exact degrees", () => {
    const context: RunComparisonContextField[] = [
      { field: "conditions", baseline: "Clear", comparand: "Rain" },
      { field: "windDirection", baseline: 180, comparand: 200 },
    ];
    const output = formatRunComparison(comparison({ context }));

    expect(rowCells(output, "Conditions")).toEqual(["Conditions", "Clear", "Rain", "(context only)"]);
    expect(rowCells(output, "Wind Direction")).toEqual(["Wind Direction", "S (180°)", "SSW (200°)", "(context only)"]);
  });

  it("renders missing context values as —", () => {
    const context: RunComparisonContextField[] = [
      { field: "conditions", baseline: null, comparand: "Rain" },
      { field: "windDirection", baseline: 180, comparand: null },
    ];
    const output = formatRunComparison(comparison({ context }));

    expect(rowCells(output, "Conditions")).toEqual(["Conditions", "—", "Rain", "(context only)"]);
    expect(rowCells(output, "Wind Direction")).toEqual(["Wind Direction", "S (180°)", "—", "(context only)"]);
  });
});

describe("degreesToCompass16 boundaries", () => {
  it("maps cardinal and intercardinal degrees to 16-point notation", () => {
    expect(degreesToCompass16(0)).toBe("N");
    expect(degreesToCompass16(22.5)).toBe("NNE");
    expect(degreesToCompass16(45)).toBe("NE");
    expect(degreesToCompass16(90)).toBe("E");
    expect(degreesToCompass16(180)).toBe("S");
    expect(degreesToCompass16(200)).toBe("SSW");
    expect(degreesToCompass16(270)).toBe("W");
    expect(degreesToCompass16(315)).toBe("NW");
  });

  it("rounds at sector boundaries and wraps 360 back to N", () => {
    // 11.25 is the N/NNE boundary; Math.round pushes it up to NNE.
    expect(degreesToCompass16(11.25)).toBe("NNE");
    // 348.75 is the NNW/N boundary; it wraps up to N.
    expect(degreesToCompass16(348.75)).toBe("N");
    expect(degreesToCompass16(360)).toBe("N");
  });

  it("normalizes out-of-range and negative degrees", () => {
    expect(degreesToCompass16(720)).toBe("N");
    expect(degreesToCompass16(-90)).toBe("W");
    expect(degreesToCompass16(-22.5)).toBe("NNW");
  });
});

describe("formatRunComparison — rounding / sign-normalization policy", () => {
  it("suppresses the sign when the delta magnitude rounds to zero", () => {
    const output = formatRunComparison(
      comparison({
        conditions: [
          // Both round to 0 C: no "−0 C", no "+0 C".
          avail<RunComparisonConditionsMetric>("temperature", 0.4, -0.4),
        ],
        performance: [
          // Both round to 250 W: equal rounded absolutes → zero delta.
          avail<RunComparisonPerformanceMetric>("avgPower", 250.1, 250.4),
        ],
      }),
    );

    const temp = rowCells(output, "Temperature")!;
    expect(temp[1]).toBe("0 C");
    expect(temp[2]).toBe("0 C");
    expect(temp[3]).toBe("0 C"); // not "−0 C" / "+0 C"

    const power = rowCells(output, "Avg Power")!;
    expect(power).toEqual(["Avg Power", "250 W", "250 W", "0 W"]);
  });

  it("derives the delta from the displayed absolutes, never the raw numbers", () => {
    const output = formatRunComparison(
      comparison({
        performance: [
          // Raw delta is +0.2 W (would render "+0 W"), but the displayed
          // absolutes are 224 W vs 225 W — a 1 W difference. The delta must
          // agree with what is shown: +1 W.
          avail<RunComparisonPerformanceMetric>("avgPower", 224.4, 224.6),
        ],
        conditions: [
          // Raw delta is +0.0099 km (rounds to 0.01); displayed absolutes are
          // 6.30 km vs 6.31 km, so the delta is +0.01 km, not 0.00.
          avail<RunComparisonConditionsMetric>("totalAscent", 6299, 6310),
        ],
      }),
    );

    expect(rowCells(output, "Avg Power")).toEqual(["Avg Power", "224 W", "225 W", "+1 W"]);
  });

  it("keeps equal rounded absolutes paired with a zero delta across unit types", () => {
    const output = formatRunComparison(
      comparison({
        performance: [
          avail<RunComparisonPerformanceMetric>("distance", 6299, 6304), // both 6.30 km
          avail<RunComparisonPerformanceMetric>("avgPace", 300.2, 300.4), // both 5:00/km
        ],
      }),
    );

    expect(rowCells(output, "Distance")).toEqual(["Distance", "6.30 km", "6.30 km", "0.00 km"]);
    expect(rowCells(output, "Avg Pace")).toEqual(["Avg Pace", "5:00/km", "5:00/km", "0:00/km"]);
  });

  it("uses the minus sign U+2212 for negative deltas", () => {
    const output = formatRunComparison(
      comparison({
        performance: [avail<RunComparisonPerformanceMetric>("rpe", 8, 6)],
      }),
    );

    expect(rowCells(output, "RPE")).toEqual(["RPE", "8", "6", "−2"]);
  });
});
