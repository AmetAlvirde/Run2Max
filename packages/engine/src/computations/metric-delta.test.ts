import { describe, expect, it } from "vitest";
import { numericDelta } from "./metric-delta.js";

// `numericDelta` is the single contract for delta direction and missing-value
// classification shared by Comparable-History Delta and Run Comparison. These
// direct tests pin the kernel; the 7 Comparable-History tests and the Run
// Comparison engine tests are its downstream regression guards.
describe("numericDelta", () => {
  it("computes delta = left - right when both sides are finite", () => {
    expect(numericDelta(260, 250)).toEqual({
      left: 260,
      right: 250,
      delta: 10,
      missing: "none",
    });
  });

  it("classifies a missing left side", () => {
    expect(numericDelta(null, 250)).toEqual({
      left: null,
      right: 250,
      delta: null,
      missing: "left",
    });
  });

  it("classifies a missing right side", () => {
    expect(numericDelta(260, null)).toEqual({
      left: 260,
      right: null,
      delta: null,
      missing: "right",
    });
  });

  it("classifies both sides missing", () => {
    expect(numericDelta(null, null)).toEqual({
      left: null,
      right: null,
      delta: null,
      missing: "both",
    });
  });

  it("coerces non-finite and non-number values to null before classifying", () => {
    expect(numericDelta(Number.NaN, 5)).toEqual({
      left: null,
      right: 5,
      delta: null,
      missing: "left",
    });
    expect(numericDelta(5, Number.POSITIVE_INFINITY)).toEqual({
      left: 5,
      right: null,
      delta: null,
      missing: "right",
    });
    expect(numericDelta("7" as unknown, undefined)).toEqual({
      left: null,
      right: null,
      delta: null,
      missing: "both",
    });
  });
});
