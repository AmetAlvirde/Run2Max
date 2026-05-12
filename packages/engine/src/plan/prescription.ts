import type { PrescribedStep } from "./types.js";

export interface PrescriptionDiagnostic {
  code: "syntax" | "unsupported" | "missing_target_range";
  message: string;
  token?: string;
  offset?: number;
}

export type PrescriptionParseResult =
  | { ok: true; steps: PrescribedStep[] }
  | { ok: false; diagnostics: PrescriptionDiagnostic[] };

export interface PrescriptionParseOptions {
  requireTargetRanges?: boolean;
}

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

  if (options?.requireTargetRanges && !hasRange) {
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

  const target =
    unit === "min"
      ? ({ kind: "duration", value: Math.round(value * 60), unit: "seconds" } as const)
      : ({ kind: "distance", value, unit: "km" } as const);

  return {
    ok: true,
    step: {
      target,
      intensityLabel: match.groups.label,
      targetRange: hasRange
        ? {
            metric: "power",
            min: Number(match.groups.min),
            max: Number(match.groups.max),
            unit: "W",
          }
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
  for (const segment of segments) {
    const parsed = parseSegment(segment, options);
    if (!parsed.ok) {
      return parsed;
    }

    for (const parsedStep of parsed.steps) {
      steps.push({
        index: steps.length + 1,
        ...parsedStep,
      });
    }
  }

  return {
    ok: true,
    steps,
  };
}
