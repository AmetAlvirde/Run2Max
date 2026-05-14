import { describe, it, expect } from "vitest";
import {
  ENGINE_VERSION,
  addDays,
  parsePrescriptionNotation,
  comparePrescriptionToSegments,
  computeComparableHistoryDelta,
} from "./index.js";

describe("engine", () => {
  it("exports a version string", () => {
    expect(ENGINE_VERSION).toBe("2.1.0");
  });

  it("exports addDays for cross-package plan date math", () => {
    expect(addDays("2026-01-26", 7)).toBe("2026-02-02");
  });

  it("exports parsePrescriptionNotation under periodization", () => {
    const result = parsePrescriptionNotation("3min @ SUB-T[260-280W]");
    expect(result.ok).toBe(true);
  });

  it("exports comparePrescriptionToSegments under analysis output", () => {
    expect(typeof comparePrescriptionToSegments).toBe("function");
  });

  it("exports computeComparableHistoryDelta under analysis output", () => {
    expect(typeof computeComparableHistoryDelta).toBe("function");
  });
});
