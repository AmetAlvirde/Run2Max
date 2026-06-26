// Run Comparison IO loader.
//
// Reads a saved Analysis Artifact off disk and extracts one comparison side.
// The arithmetic (`computeRunComparison`) and the artifact→side mapping
// (`extractRunComparisonSide`) stay pure in `computations/`; only this loader
// performs IO, through the shared `parseArtifactFile` seam.

import { basename } from "node:path";
import {
  extractRunComparisonSide,
  type RunComparisonSide,
} from "../computations/run-comparison.js";
import { parseArtifactFile } from "./parse.js";

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/** Read + parse a saved Analysis Artifact file into one comparison side. */
export async function loadRunComparisonSide(
  path: string,
  label?: string,
): Promise<RunComparisonSide> {
  const parsed = await parseArtifactFile(path);
  if (!parsed.ok) {
    throw new Error(`Could not read artifact at ${path}: ${parsed.error}`);
  }

  const artifact = asObject(parsed.data);
  if (!artifact) {
    throw new Error(`Artifact at ${path} did not parse to an object`);
  }

  return extractRunComparisonSide(artifact, label ?? basename(path));
}
