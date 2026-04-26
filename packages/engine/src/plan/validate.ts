import type { Plan, Week } from "./schema.js";
import { EXECUTED_ONLY_TYPES } from "./schema.js";

export interface Diagnostic {
  code: string;
  message: string;
  path?: string;
}

const EXECUTED_ONLY_SET = new Set<string>(EXECUTED_ONLY_TYPES);
const TEST_WEEK_TYPES = new Set(["Ta", "Tb"]);

export function validatePlan(plan: Plan): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  plan.mesocycles.forEach((meso, mi) => {
    meso.fractals.forEach((fractal, fi) => {
      const weeks = fractal.weeks;

      weeks.forEach((week, wi) => {
        const path = `mesocycles[${mi}].fractals[${fi}].weeks[${wi}]`;

        if (EXECUTED_ONLY_SET.has(week.planned)) {
          diagnostics.push({
            code: "EXECUTED_ONLY_AS_PLANNED",
            message: `"${week.planned}" is an executed-only type and cannot be used as planned`,
            path: `${path}.planned`,
          });
        }

        if (week.reason !== undefined && week.executed !== "INC" && week.executed !== "DNF") {
          diagnostics.push({
            code: "REASON_WITHOUT_DEVIATION",
            message: `reason is only valid when executed is INC or DNF`,
            path: `${path}.reason`,
          });
        }

        if (week.testingPeriod !== undefined) {
          const isTestWeek = TEST_WEEK_TYPES.has(week.planned);

          if (!isTestWeek) {
            diagnostics.push({
              code: "TESTING_PERIOD_ON_NON_TEST_WEEK",
              message: `testingPeriod is only valid on Ta or Tb weeks`,
              path: `${path}.testingPeriod`,
            });
          } else if (week.executed === "DNF") {
            diagnostics.push({
              code: "TESTING_PERIOD_ON_DNF_WEEK",
              message: `testingPeriod is not valid on a DNF week`,
              path: `${path}.testingPeriod`,
            });
          }
        }
      });

      weeks.forEach((week, wi) => {
        if (week.testingPeriod?.cp === undefined) return;

        const path = `mesocycles[${mi}].fractals[${fi}].weeks[${wi}].testingPeriod.cp`;
        const ta = findPrecedingTa(weeks, wi);
        if (ta === undefined) return;

        if (ta.executed === "DNF") {
          diagnostics.push({
            code: "CP_WITHOUT_TA_EXECUTION",
            message: `CP cannot be recorded when Ta was DNF`,
            path,
          });
        } else if (ta.executed === "INC" && ta.testingPeriod === undefined) {
          diagnostics.push({
            code: "CP_WITHOUT_TA_TEST_PERIOD",
            message: `CP cannot be recorded when Ta was INC without testingPeriod`,
            path,
          });
        }
      });
    });
  });

  return diagnostics;
}

function findPrecedingTa(weeks: readonly Week[], currentIndex: number): Week | undefined {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (weeks[i]!.planned === "Ta") return weeks[i];
  }
  return undefined;
}
