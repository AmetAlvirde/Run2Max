import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parsePlan, type Plan } from "./schema.js";
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
