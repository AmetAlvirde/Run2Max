import type { PrescribedStep } from "./types.js";

export interface PrescriptionDiagnostic {
  code: "syntax" | "unsupported" | "missing_target_range" | "invalid_target_range" | "invalid_step_target" | "repeat_count_out_of_range";
  message: string;
  token?: string;
}

export class PrescriptionNotationError extends Error {
  readonly diagnostics: ReadonlyArray<PrescriptionDiagnostic>;

  constructor(diagnostics: ReadonlyArray<PrescriptionDiagnostic>, message?: string) {
    super(message ?? `Prescription notation error (${diagnostics.length} diagnostic(s))`);
    this.name = "PrescriptionNotationError";
    this.diagnostics = diagnostics;
  }
}

export type PrescriptionParseResult =
  | { ok: true; steps: PrescribedStep[] }
  | { ok: false; diagnostics: PrescriptionDiagnostic[] };

export interface PrescriptionParseOptions {
  requireTargetRanges?: boolean | "comparable";
}

// v1 non-comparable intensity labels: easy/recovery steps that do not require
// an inline Target Range in production Plan-loading mode.
const NON_COMPARABLE_LABELS = new Set(["E", "LR", "REC"]);

function isComparableLabel(label: string): boolean {
  return !NON_COMPARABLE_LABELS.has(label);
}

// v1 cap: prevents typo-amplified expansion (e.g. 9999(...))
const MAX_REPEAT_COUNT = 50;

const STEP_PATTERN = /^(?<value>\d+(?:\.\d+)?)\s*(?<unit>K|min)\s*@\s*(?<label>[A-Za-z0-9-]+)(?:\s*\[(?<min>\d+)-(?<max>\d+)W\])?$/;
const STEP_PATTERN_ANY_UNIT = /^(?<value>\d+(?:\.\d+)?)\s*(?<unit>[A-Za-z]+)\s*@\s*(?<label>[A-Za-z0-9-]+)(?:\s*\[(?<min>\d+)-(?<max>\d+)W\])?$/;
const REPEAT_PATTERN = /^(?<count>\d+)\((?<inner>.*)\)$/;

type ParseStepResult =
  | { ok: true; step: Omit<PrescribedStep, "index"> }
  | { ok: false; diagnostics: PrescriptionDiagnostic[] };

type ParseSegmentResult =
  | { ok: true; steps: Omit<PrescribedStep, "index">[] }
  | { ok: false; diagnostics: PrescriptionDiagnostic[] };

function splitTopLevel(source: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === "(") depth += 1;
    if (char === ")" && depth > 0) depth -= 1;

    if (depth === 0 && source.slice(i, i + separator.length) === separator) {
      parts.push(source.slice(start, i).trim());
      start = i + separator.length;
      i = start - 1;
    }
  }

  parts.push(source.slice(start).trim());
  return parts;
}

function parseStep(source: string, options?: PrescriptionParseOptions): ParseStepResult {
  const anyUnitMatch = STEP_PATTERN_ANY_UNIT.exec(source);
  if (anyUnitMatch?.groups) {
    const unit = anyUnitMatch.groups.unit;
    if (unit !== "K" && unit !== "min") {
      return {
        ok: false,
        diagnostics: [
          {
            code: "unsupported",
            message: `Unsupported target unit: ${unit}`,
            token: source,
          },
        ],
      };
    }
  }

  const match = STEP_PATTERN.exec(source);

  if (!match?.groups) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "syntax",
          message: "Unsupported or malformed prescription notation",
          token: source,
        },
      ],
    };
  }

  const value = Number(match.groups.value);
  const unit = match.groups.unit;
  const hasRange = match.groups.min != null && match.groups.max != null;

  const label = match.groups.label;
  const requiresRange =
    options?.requireTargetRanges === true ||
    (options?.requireTargetRanges === "comparable" && isComparableLabel(label));

  if (requiresRange && !hasRange) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "missing_target_range",
          message: "Missing target range for intensity step",
          token: source,
        },
      ],
    };
  }

  if (value <= 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "invalid_step_target",
          message: "Distance or duration target must be greater than zero",
          token: source,
        },
      ],
    };
  }

  let parsedRange: { min: number; max: number } | undefined;
  if (hasRange) {
    const rangeMin = Number(match.groups.min);
    const rangeMax = Number(match.groups.max);
    if (rangeMin > rangeMax) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid_target_range",
            message: `Target Range min (${rangeMin}) is greater than max (${rangeMax})`,
            token: source,
          },
        ],
      };
    }
    if (rangeMin === 0 && rangeMax === 0) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "invalid_target_range",
            message: "Target Range [0-0W] cannot match any positive power value",
            token: source,
          },
        ],
      };
    }
    parsedRange = { min: rangeMin, max: rangeMax };
  }

  const target =
    unit === "min"
      ? ({ kind: "duration", value: Math.round(value * 60), unit: "seconds" } as const)
      : ({ kind: "distance", value, unit: "km" } as const);

  return {
    ok: true,
    step: {
      target,
      intensityLabel: label,
      targetRange: parsedRange
        ? { metric: "power", min: parsedRange.min, max: parsedRange.max, unit: "W" }
        : undefined,
      source,
    },
  };
}

function parseSegment(segment: string, options?: PrescriptionParseOptions): ParseSegmentResult {
  const repeatMatch = REPEAT_PATTERN.exec(segment);
  if (!repeatMatch?.groups) {
    const parsedStep = parseStep(segment, options);
    if (!parsedStep.ok) return parsedStep;
    return { ok: true, steps: [parsedStep.step] };
  }

  const count = Number(repeatMatch.groups.count);
  if (count > MAX_REPEAT_COUNT) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "repeat_count_out_of_range",
          message: `Repetition count ${count} exceeds the v1 limit of ${MAX_REPEAT_COUNT}`,
          token: segment,
        },
      ],
    };
  }

  const patternSegments = splitTopLevel(repeatMatch.groups.inner.trim(), "/");
  if (patternSegments.some((part) => part.length === 0)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "syntax",
          message: "Unsupported or malformed prescription notation",
          token: segment,
        },
      ],
    };
  }

  const patternSteps: Omit<PrescribedStep, "index">[] = [];

  for (const patternSegment of patternSegments) {
    if (REPEAT_PATTERN.exec(patternSegment)) {
      return {
        ok: false,
        diagnostics: [
          {
            code: "unsupported",
            message: "Nested repetition is not supported",
            token: patternSegment,
          },
        ],
      };
    }
    const parsedStep = parseStep(patternSegment, options);
    if (!parsedStep.ok) return parsedStep;
    patternSteps.push(parsedStep.step);
  }

  const expanded: Omit<PrescribedStep, "index">[] = [];
  for (let i = 0; i < count; i += 1) {
    expanded.push(...patternSteps);
  }

  return { ok: true, steps: expanded };
}

export function parsePrescriptionNotation(
  input: string,
  options?: PrescriptionParseOptions,
): PrescriptionParseResult {
  const segments = splitTopLevel(input, "->")
    .flatMap((segment) => splitTopLevel(segment, "→"))
    .map((segment) => segment.trim());

  if (segments.some((segment) => segment.length === 0)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "syntax",
          message: "Unsupported or malformed prescription notation",
          token: input,
        },
      ],
    };
  }

  if (segments.length === 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "syntax",
          message: "Unsupported or malformed prescription notation",
          token: input,
        },
      ],
    };
  }

  const steps: PrescribedStep[] = [];
  const allDiagnostics: PrescriptionDiagnostic[] = [];

  for (const segment of segments) {
    const parsed = parseSegment(segment, options);
    if (!parsed.ok) {
      allDiagnostics.push(...parsed.diagnostics);
      continue;
    }

    for (const parsedStep of parsed.steps) {
      steps.push({
        index: steps.length + 1,
        ...parsedStep,
      });
    }
  }

  if (allDiagnostics.length > 0) {
    return { ok: false, diagnostics: allDiagnostics };
  }

  return {
    ok: true,
    steps,
  };
}
