import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { parsePlan, type Plan } from "./schema.js";
import type { PlanTemplate } from "./templates/types.js";
import { getBuiltinTemplate } from "./templates/builtin.js";
import * as v from "valibot";

export async function loadPlan(filePath: string): Promise<Plan> {
  let contents: string;
  try {
    contents = await readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    throw err;
  }

  let raw: unknown;
  try {
    raw = parseYaml(contents);
  } catch (err) {
    throw new Error(`Failed to parse ${filePath}: ${(err as Error).message}`);
  }

  try {
    return parsePlan(raw);
  } catch (err) {
    if (err instanceof v.ValiError) {
      const issues = err.issues
        .map((issue) => {
          const path = issue.path?.map((p: { key: unknown }) => p.key).join(".") ?? "(root)";
          return `  ${path}: ${issue.message}`;
        })
        .join("\n");
      throw new Error(`Invalid plan at ${filePath}:\n${issues}`);
    }
    throw err;
  }
}

export async function loadUserTemplates(dirPath: string): Promise<PlanTemplate[]> {
  let entries: string[];
  try {
    entries = await readdir(dirPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const yamlFiles = entries.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  const templates: PlanTemplate[] = [];

  for (const file of yamlFiles) {
    const contents = await readFile(join(dirPath, file), "utf-8");
    const raw = parseYaml(contents) as PlanTemplate;
    if (raw && typeof raw.name === "string") {
      templates.push(raw);
    }
  }

  return templates;
}

export function resolveTemplate(
  name: string,
  userTemplates: PlanTemplate[]
): PlanTemplate | undefined {
  return userTemplates.find((t) => t.name === name) ?? getBuiltinTemplate(name);
}
