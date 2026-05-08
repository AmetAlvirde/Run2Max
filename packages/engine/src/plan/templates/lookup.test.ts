import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPlanTemplates, resolvePlanTemplate } from "./lookup.js";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "run2max-lookup-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const customOneMesoTemplate = `
name: 1-meso
description: Custom override
mesocycles:
  - name: CUSTOM
    fractals:
      - [L, D]
`;

const customTemplate = `
name: custom
description: A custom user template
mesocycles:
  - name: USER
    fractals:
      - [L, LL, D]
`;

describe("resolvePlanTemplate", () => {
  it("returns builtin template when called without userTemplatesDir", async () => {
    const resolved = await resolvePlanTemplate("1-meso");
    expect(resolved?.name).toBe("1-meso");
  });

  it("returns undefined for unknown template name", async () => {
    const resolved = await resolvePlanTemplate("nonexistent");
    expect(resolved).toBeUndefined();
  });

  it("uses a user template over builtin on name collision", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "override.yaml"), customOneMesoTemplate, "utf-8");

      const resolved = await resolvePlanTemplate("1-meso", { userTemplatesDir: dir });

      expect(resolved?.name).toBe("1-meso");
      expect(resolved?.description).toBe("Custom override");
      expect(resolved?.mesocycles[0]?.name).toBe("CUSTOM");
    });
  });

  it("returns user template when only user source has that name", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "custom.yaml"), customTemplate, "utf-8");

      const resolved = await resolvePlanTemplate("custom", { userTemplatesDir: dir });

      expect(resolved?.name).toBe("custom");
      expect(resolved?.mesocycles[0]?.name).toBe("USER");
    });
  });

  it("returns undefined when neither source contains the template", async () => {
    await withTempDir(async (dir) => {
      const resolved = await resolvePlanTemplate("missing", { userTemplatesDir: dir });
      expect(resolved).toBeUndefined();
    });
  });

  it("falls back to builtin when userTemplatesDir does not exist", async () => {
    const resolved = await resolvePlanTemplate("1-meso", {
      userTemplatesDir: "/no/such/dir",
    });
    expect(resolved?.name).toBe("1-meso");
  });
});

describe("listPlanTemplates", () => {
  it("returns builtin templates when called without userTemplatesDir", async () => {
    const templates = await listPlanTemplates();
    expect(templates.map((template) => template.name)).toEqual([
      "1-meso",
      "2-meso",
      "2-meso-race",
      "3-meso-race",
      "bridge",
    ]);
  });

  it("returns user templates first, then builtins", async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, "override.yaml"), customOneMesoTemplate, "utf-8");
      await writeFile(join(dir, "custom.yaml"), customTemplate, "utf-8");

      const templates = await listPlanTemplates({ userTemplatesDir: dir });
      const userNames = templates.slice(0, 2).map((template) => template.name);

      expect(new Set(userNames)).toEqual(new Set(["1-meso", "custom"]));
      expect(templates.slice(2).map((template) => template.name)).toEqual([
        "1-meso",
        "2-meso",
        "2-meso-race",
        "3-meso-race",
        "bridge",
      ]);
    });
  });

  it("returns builtins when userTemplatesDir does not exist", async () => {
    const templates = await listPlanTemplates({ userTemplatesDir: "/no/such/dir" });
    expect(templates.map((template) => template.name)).toEqual([
      "1-meso",
      "2-meso",
      "2-meso-race",
      "3-meso-race",
      "bridge",
    ]);
  });
});
