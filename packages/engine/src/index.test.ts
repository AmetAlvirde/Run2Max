import { describe, it, expect } from "vitest";
import { ENGINE_VERSION } from "./index.js";

describe("engine", () => {
  it("exports a version string", () => {
    expect(ENGINE_VERSION).toBe("1.0.0");
  });
});
