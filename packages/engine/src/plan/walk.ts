import type { Plan, Week } from "./types.js";

export interface WeekContext {
  absoluteIndex: number;
  totalWeeks: number;
  mesocycleName: string;
  mesocycleIndex: number;
  fractalIndex: number;
  totalFractals: number;
  weekIndex: number;
  week: Week;
}

export function walkPlan(plan: Plan): readonly WeekContext[] {
  const result: WeekContext[] = [];
  const totalWeeks = plan.mesocycles.reduce(
    (mesoSum, meso) => mesoSum + meso.fractals.reduce((fracSum, fractal) => fracSum + fractal.weeks.length, 0),
    0,
  );

  let absoluteIndex = 1;

  for (let mesocycleIndex = 0; mesocycleIndex < plan.mesocycles.length; mesocycleIndex++) {
    const mesocycle = plan.mesocycles[mesocycleIndex]!;
    const totalFractals = mesocycle.fractals.length;

    for (let fractalIndex = 0; fractalIndex < mesocycle.fractals.length; fractalIndex++) {
      const fractal = mesocycle.fractals[fractalIndex]!;

      for (let weekIndex = 0; weekIndex < fractal.weeks.length; weekIndex++) {
        result.push({
          absoluteIndex,
          totalWeeks,
          mesocycleName: mesocycle.name,
          mesocycleIndex,
          fractalIndex,
          totalFractals,
          weekIndex,
          week: fractal.weeks[weekIndex]!,
        });
        absoluteIndex++;
      }
    }
  }

  return result;
}
