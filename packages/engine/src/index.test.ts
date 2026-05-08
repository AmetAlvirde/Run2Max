import { describe, it, expect } from "vitest";
import { ENGINE_VERSION, addDays } from "./index.js";

describe("engine", () => {
  it("exports a version string", () => {
    expect(ENGINE_VERSION).toBe("1.1.0");
  });

  it("exports addDays for cross-package plan date math", () => {
    expect(addDays("2026-01-26", 7)).toBe("2026-02-02");
  });
});
