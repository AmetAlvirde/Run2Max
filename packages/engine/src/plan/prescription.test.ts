import { describe, it, expect } from "vitest";
import { parsePrescriptionNotation } from "./prescription.js";

describe("parsePrescriptionNotation", () => {
  it("parses a single duration step with intensity and target range", () => {
    const result = parsePrescriptionNotation("3min @ SUB-T[260-280W]");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.steps).toEqual([
      {
        index: 1,
        target: { kind: "duration", value: 180, unit: "seconds" },
        intensityLabel: "SUB-T",
        targetRange: { metric: "power", min: 260, max: 280, unit: "W" },
        source: "3min @ SUB-T[260-280W]",
      },
    ]);
  });

  it("parses a single distance step with intensity and target range", () => {
    const result = parsePrescriptionNotation("1.6K @ E[205-234W]");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.steps).toEqual([
      {
        index: 1,
        target: { kind: "distance", value: 1.6, unit: "km" },
        intensityLabel: "E",
        targetRange: { metric: "power", min: 205, max: 234, unit: "W" },
        source: "1.6K @ E[205-234W]",
      },
    ]);
  });

  it("parses an ordered sequence separated by ASCII arrows", () => {
    const result = parsePrescriptionNotation("1.6K @ E[205-234W] -> 3min @ SUB-T[260-280W]");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.steps.map((step) => step.index)).toEqual([1, 2]);
    expect(result.steps[0]?.target).toEqual({ kind: "distance", value: 1.6, unit: "km" });
    expect(result.steps[1]?.target).toEqual({ kind: "duration", value: 180, unit: "seconds" });
  });

  it("parses an ordered sequence separated by Unicode arrows", () => {
    const ascii = parsePrescriptionNotation("1.6K @ E[205-234W] -> 3min @ SUB-T[260-280W]");
    const unicode = parsePrescriptionNotation("1.6K @ E[205-234W] → 3min @ SUB-T[260-280W]");

    expect(ascii).toEqual(unicode);
  });

  it("expands repeated work/recovery groups in order", () => {
    const result = parsePrescriptionNotation("4(3min @ SUB-T[260-280W]/1min @ E)");

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.steps).toHaveLength(8);
    expect(result.steps.map((step) => step.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(result.steps[0]?.target).toEqual({ kind: "duration", value: 180, unit: "seconds" });
    expect(result.steps[1]?.target).toEqual({ kind: "duration", value: 60, unit: "seconds" });
    expect(result.steps[0]?.intensityLabel).toBe("SUB-T");
    expect(result.steps[1]?.intensityLabel).toBe("E");
  });

  it("returns missing_target_range when strict range mode is enabled", () => {
    const result = parsePrescriptionNotation("1min @ E", { requireTargetRanges: true });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("missing_target_range");
    expect(result.diagnostics[0]?.token).toBe("1min @ E");
  });

  it("returns syntax diagnostic for malformed notation", () => {
    const result = parsePrescriptionNotation("4(3min @ SUB-T[260-280W]/)");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("syntax");
  });

  it("returns unsupported diagnostic for unsupported units", () => {
    const result = parsePrescriptionNotation("30sec @ E[205-234W]");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("unsupported");
  });

  it("rejects a reversed Target Range with an invalid_target_range diagnostic", () => {
    const result = parsePrescriptionNotation("1min @ T[234-205W]");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("invalid_target_range");
    expect(result.diagnostics[0]?.token).toBe("1min @ T[234-205W]");
  });

  it("rejects a zero Target Range [0-0W] with an invalid_target_range diagnostic", () => {
    const result = parsePrescriptionNotation("1min @ T[0-0W]");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("invalid_target_range");
    expect(result.diagnostics[0]?.token).toBe("1min @ T[0-0W]");
  });

  it("rejects a zero distance step with an invalid_target_value diagnostic", () => {
    const result = parsePrescriptionNotation("0K @ E[205-234W]");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("invalid_step_target");
    expect(result.diagnostics[0]?.token).toBe("0K @ E[205-234W]");
  });

  it("rejects a zero duration step with an invalid_target_value diagnostic", () => {
    const result = parsePrescriptionNotation("0min @ T[260-280W]");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("invalid_step_target");
    expect(result.diagnostics[0]?.token).toBe("0min @ T[260-280W]");
  });

  it("rejects a repetition count over the v1 cap with a repetition_limit diagnostic", () => {
    const result = parsePrescriptionNotation("51(1min @ E)");

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.diagnostics[0]?.code).toBe("repeat_count_out_of_range");
  });

  describe("comparable mode (requireTargetRanges: 'comparable')", () => {
    it("reports missing_target_range only for the comparable step in a mixed sequence", () => {
      const result = parsePrescriptionNotation("1min @ E -> 3min @ T", {
        requireTargetRanges: "comparable",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]?.code).toBe("missing_target_range");
      expect(result.diagnostics[0]?.token).toBe("3min @ T");
    });
  });

  describe("nested repetition", () => {
    it("reports unsupported for a nested repetition group", () => {
      const result = parsePrescriptionNotation("2(3min @ E/2(1min @ T))");

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.diagnostics[0]?.code).toBe("unsupported");
      expect(result.diagnostics[0]?.token).toBe("2(1min @ T)");
    });

    it("valid nested-free repetition still parses successfully", () => {
      const result = parsePrescriptionNotation("3(1min @ T[260-280W]/1min @ E)");

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.steps).toHaveLength(6);
    });
  });

  describe("multiple independent diagnostics", () => {
    it("collects diagnostics from all independent failing top-level steps", () => {
      const result = parsePrescriptionNotation(
        "0K @ E[205-234W] -> bad -> 0min @ T[260-280W]",
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.diagnostics.length).toBeGreaterThanOrEqual(2);
      const codes = result.diagnostics.map((d) => d.code);
      expect(codes).toContain("invalid_step_target");
      expect(codes).toContain("syntax");
    });
  });

  describe("PrescriptionDiagnostic shape", () => {
    it("diagnostic does not include an offset field", () => {
      const result = parsePrescriptionNotation("bad");

      expect(result.ok).toBe(false);
      if (result.ok) return;

      const diag = result.diagnostics[0]!;
      expect(diag).not.toHaveProperty("offset");
    });
  });
});
