import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { PrescriptionComparisonRunActuals } from "../types.js";
import { transformKeysSnakeToCamel } from "./case-keys.js";

export interface ReadHistoryArtifactsOptions {
  blockDirPath: string;
  currentFitBasename: string;
  comparisonGroup: string;
}

export type HistoryRequiredField =
  | "avgPower"
  | "avgHeartRate"
  | "maxHeartRate"
  | "avgPace"
  | "rpe"
  | "comparisonGroup"
  | "capturedDate";

export interface HistoryArtifactEligible {
  status: "eligible";
  sourcePath: string;
  format: "yaml" | "json";
  fitBasename: string;
  capturedDate: string;
  comparisonGroup: string;
  actual: PrescriptionComparisonRunActuals;
}

export interface HistoryArtifactUnavailable {
  status: "unavailable";
  sourcePath: string | ReadonlyArray<string>;
  format: "yaml" | "json" | "unknown";
  fitBasename: string;
  reason:
    | "unparseable_artifact"
    | "partial_artifact"
    | "comparison_group_mismatch"
    | "ambiguous_artifact"
    | "no_paired_fit";
  missingFields?: ReadonlyArray<HistoryRequiredField>;
  parseError?: string;
}

export type HistoryArtifactDescriptor =
  | HistoryArtifactEligible
  | HistoryArtifactUnavailable;

export interface HistoryArtifactReport {
  candidates: ReadonlyArray<HistoryArtifactDescriptor>;
  topLevelReason?: "no_candidates" | "all_candidates_unavailable";
}

type ArtifactFormat = "yaml" | "json";

const REQUIRED_ACTUAL_FIELDS: ReadonlyArray<HistoryRequiredField> = [
  "avgPower",
  "avgHeartRate",
  "maxHeartRate",
  "avgPace",
  "rpe",
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function pickArtifactPath(
  blockDirPath: string,
  entries: Set<string>,
  fitBasename: string,
): { yamlPath?: string; jsonPath?: string } {
  const yamlFile = `${fitBasename}.yaml`;
  const ymlFile = `${fitBasename}.yml`;
  const jsonFile = `${fitBasename}.json`;

  const yamlPath = entries.has(yamlFile)
    ? join(blockDirPath, yamlFile)
    : entries.has(ymlFile)
      ? join(blockDirPath, ymlFile)
      : undefined;

  const jsonPath = entries.has(jsonFile)
    ? join(blockDirPath, jsonFile)
    : undefined;

  return { yamlPath, jsonPath };
}

function normalizeParsedArtifact(
  format: ArtifactFormat,
  parsed: unknown,
): Record<string, unknown> | undefined {
  const normalized = format === "yaml"
    ? transformKeysSnakeToCamel(parsed)
    : parsed;
  return asObject(normalized);
}

function toMetricValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function hasAtLeastOneActualValue(actual: Record<string, unknown>): boolean {
  return REQUIRED_ACTUAL_FIELDS.some((field) => {
    const value = actual[field];
    return typeof value === "number" && Number.isFinite(value);
  });
}

function toPartialDescriptor(
  base: Pick<HistoryArtifactUnavailable, "sourcePath" | "format" | "fitBasename">,
  missingFields: HistoryRequiredField[],
): HistoryArtifactUnavailable {
  return {
    status: "unavailable",
    ...base,
    reason: "partial_artifact",
    ...(missingFields.length === 0 ? {} : { missingFields }),
  };
}

async function classifySingleArtifact(
  options: ReadHistoryArtifactsOptions,
  params: {
    sourcePath: string;
    fitBasename: string;
    format: ArtifactFormat;
  },
): Promise<HistoryArtifactDescriptor> {
  let contents: string;
  try {
    contents = await readFile(params.sourcePath, "utf-8");
  } catch (err) {
    return {
      status: "unavailable",
      sourcePath: params.sourcePath,
      format: params.format,
      fitBasename: params.fitBasename,
      reason: "unparseable_artifact",
      parseError: (err as Error).message,
    };
  }

  let parsed: unknown;
  try {
    parsed = params.format === "yaml" ? parseYaml(contents) : JSON.parse(contents);
  } catch (err) {
    return {
      status: "unavailable",
      sourcePath: params.sourcePath,
      format: params.format,
      fitBasename: params.fitBasename,
      reason: "unparseable_artifact",
      parseError: (err as Error).message,
    };
  }

  const artifact = normalizeParsedArtifact(params.format, parsed);
  if (!artifact) {
    return toPartialDescriptor(
      {
        sourcePath: params.sourcePath,
        format: params.format,
        fitBasename: params.fitBasename,
      },
      ["capturedDate", "comparisonGroup", ...REQUIRED_ACTUAL_FIELDS],
    );
  }

  const summary = asObject(artifact.summary);
  const comparison = asObject(artifact.prescriptionComparison);
  const prescribedRun = asObject(comparison?.prescribedRun);
  const comparisonActual = asObject(comparison?.actual);
  const rootActual = asObject(artifact.actual);
  const actual = comparisonActual ?? rootActual ?? {};

  const capturedDate = isNonEmptyString(artifact.capturedDate)
    ? artifact.capturedDate.trim()
    : isNonEmptyString(summary?.date)
      ? summary.date.trim().slice(0, 10)
      : undefined;

  const artifactComparisonGroup = isNonEmptyString(artifact.comparisonGroup)
    ? artifact.comparisonGroup.trim()
    : isNonEmptyString(prescribedRun?.comparisonGroup)
      ? prescribedRun.comparisonGroup.trim()
      : undefined;

  const missingFields: HistoryRequiredField[] = [];
  if (!capturedDate) {
    missingFields.push("capturedDate");
  }
  if (!artifactComparisonGroup) {
    missingFields.push("comparisonGroup");
  }
  if (!hasAtLeastOneActualValue(actual)) {
    missingFields.push(...REQUIRED_ACTUAL_FIELDS);
  }

  const duration = actual.duration;
  const distance = actual.distance;
  if (
    typeof duration !== "number"
    || !Number.isFinite(duration)
    || typeof distance !== "number"
    || !Number.isFinite(distance)
  ) {
    return toPartialDescriptor(
      {
        sourcePath: params.sourcePath,
        format: params.format,
        fitBasename: params.fitBasename,
      },
      missingFields,
    );
  }

  if (missingFields.length > 0) {
    return toPartialDescriptor(
      {
        sourcePath: params.sourcePath,
        format: params.format,
        fitBasename: params.fitBasename,
      },
      missingFields,
    );
  }

  if (artifactComparisonGroup !== options.comparisonGroup) {
    return {
      status: "unavailable",
      sourcePath: params.sourcePath,
      format: params.format,
      fitBasename: params.fitBasename,
      reason: "comparison_group_mismatch",
    };
  }

  return {
    status: "eligible",
    sourcePath: params.sourcePath,
    format: params.format,
    fitBasename: params.fitBasename,
    capturedDate: capturedDate as string,
    comparisonGroup: artifactComparisonGroup as string,
    actual: {
      duration,
      distance,
      avgPower: toMetricValue(actual.avgPower),
      avgHeartRate: toMetricValue(actual.avgHeartRate),
      maxHeartRate: toMetricValue(actual.maxHeartRate),
      avgPace: toMetricValue(actual.avgPace),
      ...(typeof actual.rpe === "number" && Number.isFinite(actual.rpe)
        ? { rpe: actual.rpe }
        : {}),
    },
  };
}

export async function readHistoryArtifacts(
  options: ReadHistoryArtifactsOptions,
): Promise<HistoryArtifactReport> {
  if (!options.currentFitBasename) {
    throw new Error("currentFitBasename must be non-empty");
  }
  if (!options.comparisonGroup) {
    throw new Error("comparisonGroup must be non-empty");
  }

  let entries: string[];
  try {
    entries = await readdir(options.blockDirPath);
  } catch {
    return { candidates: [], topLevelReason: "no_candidates" };
  }

  const entrySet = new Set(entries);
  const fitBasenames = Array.from(
    new Set(
      entries
        .filter((entry) => /\.fit$/i.test(entry))
        .map((entry) => entry.replace(/\.fit$/i, ""))
        .filter((basename) => basename !== options.currentFitBasename),
    ),
  ).sort();

  const candidates: HistoryArtifactDescriptor[] = [];

  for (const fitBasename of fitBasenames) {
    const { yamlPath, jsonPath } = pickArtifactPath(
      options.blockDirPath,
      entrySet,
      fitBasename,
    );

    if (yamlPath && jsonPath) {
      candidates.push({
        status: "unavailable",
        sourcePath: [yamlPath, jsonPath],
        format: "unknown",
        fitBasename,
        reason: "ambiguous_artifact",
      });
      continue;
    }

    if (!yamlPath && !jsonPath) {
      continue;
    }

    const sourcePath = (yamlPath ?? jsonPath) as string;
    const format: ArtifactFormat = yamlPath ? "yaml" : "json";
    candidates.push(
      await classifySingleArtifact(options, {
        sourcePath,
        fitBasename,
        format,
      }),
    );
  }

  if (candidates.length === 0) {
    return { candidates, topLevelReason: "no_candidates" };
  }

  const allUnavailable = candidates.every(
    (candidate) => candidate.status === "unavailable",
  );

  return allUnavailable
    ? { candidates, topLevelReason: "all_candidates_unavailable" }
    : { candidates };
}
