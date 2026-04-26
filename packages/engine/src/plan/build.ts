import type { PlanTemplate } from "./templates/types.js";
import type { Plan } from "./schema.js";

export interface BuildPlanOptions {
  block: string;
  start: string;
  goal?: string;
  distance?: string;
  raceDate?: string;
  weekStart?: string;
}

const DAY_NUMBERS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildPlanFromTemplate(template: PlanTemplate, options: BuildPlanOptions): Plan {
  const weekStartDay = options.weekStart ?? "monday";
  const expectedDayNum = DAY_NUMBERS[weekStartDay];

  if (expectedDayNum === undefined) {
    throw new Error(`Invalid weekStart value: "${weekStartDay}"`);
  }

  const startDate = new Date(`${options.start}T00:00:00Z`);
  if (startDate.getUTCDay() !== expectedDayNum) {
    const actualDay = Object.keys(DAY_NUMBERS).find(
      (k) => DAY_NUMBERS[k] === startDate.getUTCDay()
    );
    throw new Error(
      `Start date ${options.start} does not fall on ${weekStartDay} (it's a ${actualDay})`
    );
  }

  let weekIndex = 0;
  const mesocycles = template.mesocycles.map((meso) => ({
    name: meso.name,
    fractals: meso.fractals.map((fractal) => ({
      weeks: fractal.map((weekType) => {
        const weekStart = addDays(options.start, weekIndex * 7);
        weekIndex++;
        return { planned: weekType, start: weekStart };
      }),
    })),
  }));

  return {
    schemaVersion: 1,
    block: options.block,
    ...(options.goal !== undefined && { goal: options.goal }),
    ...(options.distance !== undefined && { distance: options.distance }),
    ...(options.raceDate !== undefined && { raceDate: options.raceDate }),
    start: options.start,
    mesocycles,
  };
}
