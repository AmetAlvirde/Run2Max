// Shared Analysis Artifact parse seam.
//
// One IO helper that reads a saved Analysis Artifact (yaml or json), sniffs the
// format from the file extension, and normalizes the snake_case yaml path back
// to camelCase via `transformKeysSnakeToCamel`. JSON artifacts are written in
// camelCase and pass through untouched.
//
// Both `plan/history.ts` (Comparable-History Delta loading) and Run Comparison
// consume this, so the yaml/json parse + normalization rules live here once.

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { transformKeysSnakeToCamel } from "../plan/case-keys.js";

export type ArtifactFormat = "yaml" | "json";

export type ParseArtifactResult =
  | { ok: true; format: ArtifactFormat; data: unknown }
  | { ok: false; format: ArtifactFormat; error: string };

/** Sniff the on-disk artifact format from the path extension (`.yaml`/`.yml` → yaml). */
export function sniffArtifactFormat(path: string): ArtifactFormat {
  return /\.ya?ml$/i.test(path) ? "yaml" : "json";
}

/**
 * Read + parse a saved Analysis Artifact into a normalized (camelCased) value.
 * Returns a result rather than throwing so callers can map read/parse failures
 * onto their own error vocabulary. The returned `data` is the parsed value, not
 * necessarily an object — callers decide how to treat a non-object payload.
 */
export async function parseArtifactFile(path: string): Promise<ParseArtifactResult> {
  const format = sniffArtifactFormat(path);

  let contents: string;
  try {
    contents = await readFile(path, "utf-8");
  } catch (err) {
    return { ok: false, format, error: (err as Error).message };
  }

  let parsed: unknown;
  try {
    parsed = format === "yaml" ? parseYaml(contents) : JSON.parse(contents);
  } catch (err) {
    return { ok: false, format, error: (err as Error).message };
  }

  const data = format === "yaml" ? transformKeysSnakeToCamel(parsed) : parsed;
  return { ok: true, format, data };
}
