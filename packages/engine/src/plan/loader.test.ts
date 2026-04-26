import { describe, it, expect } from "vitest";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPlan } from "./loader.js";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "run2max-loader-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const validPlanYaml = `
schema_version: 1
block: build
start: 2026-05-04
mesocycles:
  - name: CANAL
    fractals:
      - weeks:
          - planned: L
            start: 2026-05-04
`;

describe("loadPlan", () => {
  it("parses a valid plan.yaml file", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "plan.yaml");
      await writeFile(filePath, validPlanYaml, "utf-8");

      const plan = await loadPlan(filePath);

      expect(plan.schemaVersion).toBe(1);
      expect(plan.block).toBe("build");
      expect(plan.start).toBe("2026-05-04");
      expect(plan.mesocycles).toHaveLength(1);
      expect(plan.mesocycles[0]!.name).toBe("CANAL");
    });
  });

  it("throws when file not found", async () => {
    await expect(loadPlan("/nonexistent/path/plan.yaml")).rejects.toThrow(
      "File not found: /nonexistent/path/plan.yaml"
    );
  });

  it("throws with descriptive error on invalid YAML", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "plan.yaml");
      await writeFile(filePath, "block: {\n  bad yaml: [unclosed", "utf-8");

      await expect(loadPlan(filePath)).rejects.toThrow(/Failed to parse/);
    });
  });

  it("transforms snake_case keys to camelCase", async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, "plan.yaml");
      const yaml = `
schema_version: 1
block: build
race_date: 2026-10-18
start: 2026-05-04
mesocycles:
  - name: CANAL
    fractals:
      - weeks:
          - planned: Ta
            start: 2026-05-04
            testing_period:
              cp: 302
`;
      await writeFile(filePath, yaml, "utf-8");

      const plan = await loadPlan(filePath);

      expect(plan.raceDate).toBe("2026-10-18");
      expect(plan.mesocycles[0]!.fractals[0]!.weeks[0]!.testingPeriod?.cp).toBe(302);
    });
  });
});
