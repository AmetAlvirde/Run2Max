import type { Plan } from "./schema.js";
import type { PlanTemplate } from "./templates/types.js";
import { reconcile } from "./reconcile.js";
import type { CompressionOption } from "./reconcile.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AdjustOptions {
  strategy?: string;
  raceDate?: string;
  weekStart?: string;
  distance?: string;
}

export type AdjustResult =
  | { mode: "plan"; plan: Plan }
  | {
      mode: "info";
      frozenWeeks: number;
      adjustableWeeks: number;
      availableStrategies: CompressionOption[];
      currentRaceDate?: string;
    };

export class AdjustError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AdjustError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface FlatWeek {
  absoluteIndex: number; // 1-based
  mesoIndex: number;
  fractalIndex: number;
  weekIndex: number;
  planned: string;
  start: string;
  executed?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenWeeks(plan: Plan): FlatWeek[] {
  const result: FlatWeek[] = [];
  let idx = 1;

  for (let mi = 0; mi < plan.mesocycles.length; mi++) {
    const meso = plan.mesocycles[mi]!;
    for (let fi = 0; fi < meso.fractals.length; fi++) {
      const fractal = meso.fractals[fi]!;
      for (let wi = 0; wi < fractal.weeks.length; wi++) {
        const week = fractal.weeks[wi]!;
        result.push({
          absoluteIndex: idx++,
          mesoIndex: mi,
          fractalIndex: fi,
          weekIndex: wi,
          planned: week.planned,
          start: week.start,
          executed: week.executed,
          note: week.note,
        });
      }
    }
  }

  return result;
}

/**
 * Builds a PlanTemplate from the adjustable (future) portion of the plan.
 * Preserves mesocycle names and fractal groupings.
 *
 * If the frontier falls in the middle of a fractal, the boundary fractal's
 * future weeks form the first (partial) fractal of the frontier mesocycle.
 */
function extractFutureTemplate(
  plan: Plan,
  flatWeeks: FlatWeek[],
  frontierIdx: number,
): PlanTemplate {
  const frontier = flatWeeks[frontierIdx]!;
  const { mesoIndex: fMi, fractalIndex: fFi, weekIndex: fWi } = frontier;

  const mesocycles: PlanTemplate["mesocycles"] = [];

  for (let mi = fMi; mi < plan.mesocycles.length; mi++) {
    const meso = plan.mesocycles[mi]!;
    const startFi = mi === fMi ? fFi : 0;
    const fractals: string[][] = [];

    for (let fi = startFi; fi < meso.fractals.length; fi++) {
      const fractal = meso.fractals[fi]!;
      const startWi = mi === fMi && fi === fFi ? fWi : 0;
      const weekTypes = fractal.weeks.slice(startWi).map((w) => w.planned);
      if (weekTypes.length > 0) {
        fractals.push(weekTypes);
      }
    }

    if (fractals.length > 0) {
      mesocycles.push({ name: meso.name, fractals });
    }
  }

  return { name: "future", description: "extracted future portion", mesocycles };
}

/**
 * Deep-clones a Plan (structural copy sufficient for immutable updates).
 */
function clonePlan(plan: Plan): Plan {
  return {
    ...plan,
    mesocycles: plan.mesocycles.map((meso) => ({
      ...meso,
      fractals: meso.fractals.map((fractal) => ({
        ...fractal,
        weeks: fractal.weeks.map((week) => ({ ...week })),
      })),
    })),
  };
}

/**
 * Merges the frozen (executed) portion of the original plan with the
 * reconciled future plan, returning a complete updated plan.
 *
 * The frontier is the first week without `executed`. Everything before it
 * is frozen; everything from it onward comes from the reconciled future plan.
 */
function mergeFrozenAndFuture(
  originalPlan: Plan,
  flatWeeks: FlatWeek[],
  frontierIdx: number,
  futurePlan: Plan,
  newRaceDate?: string,
): Plan {
  const frontier = flatWeeks[frontierIdx]!;
  const { mesoIndex: fMi, fractalIndex: fFi, weekIndex: fWi } = frontier;

  // Build the frozen mesocycles that come entirely before the frontier mesocycle
  const outputMesos: Plan["mesocycles"] = [];

  for (let mi = 0; mi < fMi; mi++) {
    const meso = originalPlan.mesocycles[mi]!;
    outputMesos.push({
      ...meso,
      fractals: meso.fractals.map((f) => ({
        ...f,
        weeks: f.weeks.map((w) => ({ ...w })),
      })),
    });
  }

  // Collect frozen fractals from the frontier mesocycle
  const frontierMeso = originalPlan.mesocycles[fMi]!;
  const frozenFractals: Plan["mesocycles"][number]["fractals"] = [];

  // Fractals entirely before the frontier fractal
  for (let fi = 0; fi < fFi; fi++) {
    frozenFractals.push({
      weeks: frontierMeso.fractals[fi]!.weeks.map((w) => ({ ...w })),
    });
  }

  // Frozen portion of the frontier fractal (if frontier is mid-fractal)
  if (fWi > 0) {
    frozenFractals.push({
      weeks: frontierMeso.fractals[fFi]!.weeks.slice(0, fWi).map((w) => ({ ...w })),
    });
  }

  // Attach the frontier mesocycle and all future mesocycles.
  // The future plan's mesocycles[0] corresponds to the frontier mesocycle
  // (same name), unless all its fractals were dropped by the strategy.
  const futureMesos = futurePlan.mesocycles;

  if (futureMesos.length > 0 && futureMesos[0]!.name === frontierMeso.name) {
    // The future plan continues the frontier mesocycle
    const futureFractalsFromFrontierMeso = futureMesos[0]!.fractals;

    let combinedFractals: Plan["mesocycles"][number]["fractals"];

    if (fWi > 0 && frozenFractals.length > 0 && futureFractalsFromFrontierMeso.length > 0) {
      // Last frozen fractal and first future fractal are both parts of the
      // same original fractal — merge their weeks into a single fractal.
      const mergedBoundaryFractal = {
        weeks: [
          ...frozenFractals[frozenFractals.length - 1]!.weeks,
          ...futureFractalsFromFrontierMeso[0]!.weeks,
        ],
      };
      combinedFractals = [
        ...frozenFractals.slice(0, -1),
        mergedBoundaryFractal,
        ...futureFractalsFromFrontierMeso.slice(1),
      ];
    } else {
      combinedFractals = [...frozenFractals, ...futureFractalsFromFrontierMeso];
    }

    outputMesos.push({ name: frontierMeso.name, fractals: combinedFractals });

    for (let i = 1; i < futureMesos.length; i++) {
      outputMesos.push(futureMesos[i]!);
    }
  } else {
    // The future plan starts with a different mesocycle (all fractals of
    // the frontier mesocycle were dropped by the strategy, or the frontier
    // is at a clean mesocycle boundary).
    if (frozenFractals.length > 0) {
      outputMesos.push({ name: frontierMeso.name, fractals: frozenFractals });
    }
    for (const futureMeso of futureMesos) {
      outputMesos.push(futureMeso);
    }
  }

  return {
    ...originalPlan,
    ...(newRaceDate !== undefined ? { raceDate: newRaceDate } : {}),
    mesocycles: outputMesos,
  };
}

/**
 * Applies notes from the original future weeks to the merged plan.
 * Notes are matched by position in the flat future week list and
 * preserved only when the planned type is unchanged at that position.
 *
 * This is non-destructive: notes are only applied when the week structure
 * is unchanged (same planned type at the same relative position).
 */
function preserveFutureNotes(
  mergedPlan: Plan,
  originalFlatWeeks: FlatWeek[],
  frontierIdx: number,
): Plan {
  // Collect (relativeIdx, planned, note) from original future weeks
  const originalFutureNotes: Array<{ relPos: number; planned: string; note: string }> = [];
  for (let i = frontierIdx; i < originalFlatWeeks.length; i++) {
    const fw = originalFlatWeeks[i]!;
    if (fw.note !== undefined) {
      originalFutureNotes.push({
        relPos: i - frontierIdx,
        planned: fw.planned,
        note: fw.note,
      });
    }
  }

  if (originalFutureNotes.length === 0) return mergedPlan;

  // Flatten future weeks in merged plan
  // Count frozen weeks (those with executed) — the future weeks come after
  const mergedFlat = mergedPlan.mesocycles.flatMap((m) =>
    m.fractals.flatMap((f) => f.weeks),
  );

  const frozenCount = mergedFlat.filter((w) => w.executed !== undefined).length;

  // Apply notes where planned type matches at same relative position
  const result = clonePlan(mergedPlan);
  const resultFlat = result.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f.weeks));

  for (const { relPos, planned, note } of originalFutureNotes) {
    const targetIdx = frozenCount + relPos;
    const targetWeek = resultFlat[targetIdx];
    if (targetWeek && targetWeek.planned === planned && targetWeek.executed === undefined) {
      targetWeek.note = note;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Adjusts the future (unexecuted) portion of a training plan.
 *
 * - `strategy`: applies a named compression strategy to future weeks
 * - `raceDate`: re-reconciles future weeks against a new race date
 * - neither: returns an informational view of the current future structure
 *
 * Executed weeks are frozen and never modified.
 *
 * @throws AdjustError when no future weeks exist or strategy is impossible
 */
export function adjustPlan(plan: Plan, options: AdjustOptions): AdjustResult {
  const flat = flattenWeeks(plan);

  // Find the frontier: first week without executed
  const frontierIdx = flat.findIndex((w) => w.executed === undefined);

  if (frontierIdx === -1) {
    throw new AdjustError(
      "all weeks are already executed; nothing to adjust",
      "NO_FUTURE_WEEKS",
    );
  }

  const futureTemplate = extractFutureTemplate(plan, flat, frontierIdx);
  const startOfFuture = flat[frontierIdx]!.start;
  const effectiveRaceDate = options.raceDate ?? plan.raceDate;

  // ── Informational mode ─────────────────────────────────────────────────────

  if (options.strategy === undefined && options.raceDate === undefined) {
    const frozenWeeks = frontierIdx;
    const adjustableWeeks = flat.length - frontierIdx;

    let availableStrategies: CompressionOption[] = [];

    if (effectiveRaceDate !== undefined) {
      const result = reconcile({
        template: futureTemplate,
        start: startOfFuture,
        raceDate: effectiveRaceDate,
        distance: options.distance ?? plan.distance,
        weekStart: options.weekStart,
      });
      availableStrategies = result.options;
    }

    return {
      mode: "info",
      frozenWeeks,
      adjustableWeeks,
      availableStrategies,
      currentRaceDate: plan.raceDate,
    };
  }

  // ── Strategy / race-date mode ──────────────────────────────────────────────

  if (effectiveRaceDate === undefined) {
    throw new AdjustError(
      "plan has no race_date; provide --race-date to adjust a bridge block",
      "NO_RACE_DATE",
    );
  }

  const reconcileResult = reconcile({
    template: futureTemplate,
    start: startOfFuture,
    raceDate: effectiveRaceDate,
    distance: options.distance ?? plan.distance,
    weekStart: options.weekStart,
    strategy: options.strategy,
  });

  if (reconcileResult.plan === null) {
    throw new AdjustError(
      options.strategy !== undefined
        ? `strategy "${options.strategy}" cannot be applied to the current future weeks`
        : "future weeks do not fit the new race date; provide --strategy to compress",
      "STRATEGY_IMPOSSIBLE",
    );
  }

  // Merge frozen history + reconciled future weeks
  const merged = mergeFrozenAndFuture(
    plan,
    flat,
    frontierIdx,
    reconcileResult.plan,
    options.raceDate, // only update raceDate when explicitly changed
  );

  // Preserve notes from original future weeks where structure is unchanged
  const withNotes = preserveFutureNotes(merged, flat, frontierIdx);

  return { mode: "plan", plan: withNotes };
}
