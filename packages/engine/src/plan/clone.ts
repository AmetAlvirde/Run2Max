import type { Plan } from "./types.js";

export function clonePlan(plan: Plan): Plan {
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
