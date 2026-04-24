import { describe, it, expect } from "vitest";
import {
  avg,
  rollingWindowPeak,
  rollingWindowMin,
  computeFileSampleRate,
  computeNormalizedPower,
} from "./utils.js";

// ---------------------------------------------------------------------------
// avg (existing)
// ---------------------------------------------------------------------------

describe("avg", () => {
  it("returns null for empty array", () => {
    expect(avg([])).toBeNull();
  });

  it("returns null when all values are null", () => {
    expect(avg([null, null])).toBeNull();
  });

  it("computes mean ignoring nulls", () => {
    expect(avg([10, null, 20, null, 30])).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// rollingWindowPeak
// ---------------------------------------------------------------------------

describe("rollingWindowPeak", () => {
  it("returns null for empty array", () => {
    expect(rollingWindowPeak([], 5)).toBeNull();
  });

  it("returns null when all values are null", () => {
    expect(rollingWindowPeak([null, null, null], 3)).toBeNull();
  });

  it("returns value for single-element array with window=1", () => {
    expect(rollingWindowPeak([250], 1)).toBe(250);
  });

  it("returns the max of rolling window averages", () => {
    // Windows of 3 over [100, 200, 300, 400, 500]:
    // [100,200,300]=200, [200,300,400]=300, [300,400,500]=400 → peak = 400
    expect(rollingWindowPeak([100, 200, 300, 400, 500], 3)).toBeCloseTo(400);
  });

  it("returns single window average when windowSize equals array length", () => {
    expect(rollingWindowPeak([100, 200, 300], 3)).toBeCloseTo(200);
  });

  it("falls back to full-array average when windowSize > array length", () => {
    // Only 3 values, window of 5 → use all 3 → avg = 200
    expect(rollingWindowPeak([100, 200, 300], 5)).toBeCloseTo(200);
  });

  it("skips nulls within a window when computing the window average", () => {
    // [null, 200, null, 200, null] with window=3:
    // window [null,200,null]=200, [200,null,200]=200, [null,200,null]=200 → peak = 200
    expect(rollingWindowPeak([null, 200, null, 200, null], 3)).toBeCloseTo(200);
  });

  it("handles window that contains only nulls — skips it", () => {
    // windows of 2: [null,null]=null (skip), [null,300]=300 → peak = 300
    expect(rollingWindowPeak([null, null, 300], 2)).toBeCloseTo(300);
  });

  it("returns constant value for uniform input", () => {
    const vals = Array(10).fill(250) as number[];
    expect(rollingWindowPeak(vals, 5)).toBeCloseTo(250);
  });
});

// ---------------------------------------------------------------------------
// rollingWindowMin
// ---------------------------------------------------------------------------

describe("rollingWindowMin", () => {
  it("returns null for empty array", () => {
    expect(rollingWindowMin([], 5)).toBeNull();
  });

  it("returns null when all values are null", () => {
    expect(rollingWindowMin([null, null], 2)).toBeNull();
  });

  it("returns the min of rolling window averages", () => {
    // Windows of 3 over [100, 200, 300, 400, 500]:
    // [100,200,300]=200, [200,300,400]=300, [300,400,500]=400 → min = 200
    expect(rollingWindowMin([100, 200, 300, 400, 500], 3)).toBeCloseTo(200);
  });

  it("falls back to full-array average when windowSize > array length", () => {
    expect(rollingWindowMin([300, 200, 100], 5)).toBeCloseTo(200);
  });

  it("finds fastest pace window (lower = faster)", () => {
    // Pace in sec/km: [360, 360, 360, 300, 300, 300, 360, 360, 360]
    // Best 3-window: [300,300,300]=300 → min = 300
    const pace = [360, 360, 360, 300, 300, 300, 360, 360, 360];
    expect(rollingWindowMin(pace, 3)).toBeCloseTo(300);
  });
});

// ---------------------------------------------------------------------------
// computeFileSampleRate
// ---------------------------------------------------------------------------

describe("computeFileSampleRate", () => {
  it("returns null for empty array", () => {
    expect(computeFileSampleRate([])).toBeNull();
  });

  it("returns null for single record", () => {
    expect(computeFileSampleRate([{ timestamp: new Date() }])).toBeNull();
  });

  it("returns null when all timestamps are missing", () => {
    expect(computeFileSampleRate([{}, {}])).toBeNull();
  });

  it("returns 1 for 1-second intervals from Date objects", () => {
    const base = new Date("2026-04-12T08:00:00Z").getTime();
    const records = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(base + i * 1000),
    }));
    expect(computeFileSampleRate(records)).toBe(1);
  });

  it("returns 1 for 1-second intervals from epoch ms numbers", () => {
    const base = 1744444800000;
    const records = Array.from({ length: 5 }, (_, i) => ({
      timestamp: base + i * 1000,
    }));
    expect(computeFileSampleRate(records)).toBe(1);
  });

  it("returns 1 for 1-second intervals from ISO strings", () => {
    const base = new Date("2026-04-12T08:00:00Z");
    const records = Array.from({ length: 5 }, (_, i) => ({
      timestamp: new Date(base.getTime() + i * 1000).toISOString(),
    }));
    expect(computeFileSampleRate(records)).toBe(1);
  });

  it("returns modal interval when intervals are mixed", () => {
    // 4 intervals of 1s, 1 interval of 5s → mode = 1
    const base = new Date("2026-04-12T08:00:00Z").getTime();
    const ts = [0, 1000, 2000, 3000, 4000, 9000].map(d => new Date(base + d));
    expect(computeFileSampleRate(ts.map(t => ({ timestamp: t })))).toBe(1);
  });

  it("returns 5 for 5-second sampled data", () => {
    const base = new Date("2026-04-12T08:00:00Z").getTime();
    const records = Array.from({ length: 10 }, (_, i) => ({
      timestamp: new Date(base + i * 5000),
    }));
    expect(computeFileSampleRate(records)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// computeNormalizedPower
// ---------------------------------------------------------------------------

describe("computeNormalizedPower", () => {
  it("returns null for empty array", () => {
    expect(computeNormalizedPower([], 30)).toBeNull();
  });

  it("returns null when all values are null", () => {
    expect(computeNormalizedPower(Array(60).fill(null), 30)).toBeNull();
  });

  it("returns null when fewer records than window size", () => {
    expect(computeNormalizedPower([200, 210], 30)).toBeNull();
  });

  it("returns the constant power value for uniform input", () => {
    // NP of constant power P is P regardless of window size
    const vals = Array(120).fill(250) as number[];
    expect(computeNormalizedPower(vals, 30)).toBeCloseTo(250, 0);
  });

  it("NP is higher than avg power for variable input", () => {
    // 60 records at 100W then 60 records at 400W — avg = 250
    // Rolling averages range from 100 to 400, so NP >> 250 due to 4th-power bias
    const vals = [...Array(60).fill(100), ...Array(60).fill(400)] as number[];
    const np = computeNormalizedPower(vals, 30)!;
    expect(np).toBeGreaterThan(250);
  });

  it("NP is always >= avg power", () => {
    const vals = [200, 220, 240, 250, 260, 280, 300, 350, 200, 180].flatMap(v =>
      Array(12).fill(v)
    ); // 120 values
    const npResult = computeNormalizedPower(vals, 30)!;
    const avgResult = avg(vals)!;
    expect(npResult).toBeGreaterThanOrEqual(avgResult - 0.001);
  });
});
