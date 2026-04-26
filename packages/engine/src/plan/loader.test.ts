import { describe, it, expect } from "vitest";
import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadPlan, loadUserTemplates, resolveTemplate } from "./loader.js";
import type { PlanTemplate } from "./templates/types.js";

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

describe("loadUserTemplates", () => {
  it("returns templates from directory", async () => {
    await withTempDir(async (dir) => {
      const yaml = `
name: my-template
description: A custom template
mesocycles:
  - name: MESO-1
    fractals:
      - [L, LL, D]
`;
      await writeFile(join(dir, "my-template.yaml"), yaml, "utf-8");
      const templates = await loadUserTemplates(dir);
      expect(templates).toHaveLength(1);
      expect(templates[0]!.name).toBe("my-template");
    });
  });

  it("returns empty array when directory does not exist", async () => {
    const templates = await loadUserTemplates("/nonexistent/path/templates");
    expect(templates).toEqual([]);
  });

  it("uses name field from YAML, not file name", async () => {
    await withTempDir(async (dir) => {
      const yaml = `
name: canonical-name
description: Template with a different canonical name
mesocycles:
  - name: MESO-1
    fractals:
      - [L, D]
`;
      await writeFile(join(dir, "file-name.yaml"), yaml, "utf-8");
      const templates = await loadUserTemplates(dir);
      expect(templates[0]!.name).toBe("canonical-name");
    });
  });
});

describe("resolveTemplate", () => {
  it("user template overrides built-in on name collision", () => {
    const customOneMeso: PlanTemplate = {
      name: "1-meso",
      description: "Custom override",
      mesocycles: [{ name: "CUSTOM", fractals: [["L", "D"]] }],
    };
    const resolved = resolveTemplate("1-meso", [customOneMeso]);
    expect(resolved!.description).toBe("Custom override");
    expect(resolved!.mesocycles[0]!.name).toBe("CUSTOM");
  });

  it("falls back to built-in when no user template matches", () => {
    const resolved = resolveTemplate("1-meso", []);
    expect(resolved!.name).toBe("1-meso");
    expect(resolved!.mesocycles).toHaveLength(1);
  });

  it("returns undefined for unknown template name", () => {
    const resolved = resolveTemplate("nonexistent", []);
    expect(resolved).toBeUndefined();
  });
});
