import type { Plan, Week } from "./types.js";
import { EXECUTED_ONLY_TYPES } from "./schema.js";
import { walkPlan } from "./walk.js";
import type { WeekContext } from "./walk.js";

export interface Diagnostic {
  code: string;
  message: string;
  path?: string;
}

const EXECUTED_ONLY_SET = new Set<string>(EXECUTED_ONLY_TYPES);
const TEST_WEEK_TYPES = new Set(["Ta", "Tb"]);

export function validatePlan(plan: Plan): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const contexts = walkPlan(plan);

  contexts.forEach((ctx, i) => {
    const week = ctx.week;
    const path = `mesocycles[${ctx.mesocycleIndex}].fractals[${ctx.fractalIndex}].weeks[${ctx.weekIndex}]`;

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

    if (week.testingPeriod?.cp === undefined) {
      return;
    }

    const cpPath = `${path}.testingPeriod.cp`;
    const ta = findPrecedingTa(contexts, i);
    if (ta === undefined) {
      return;
    }

    if (ta.executed === "DNF") {
      diagnostics.push({
        code: "CP_WITHOUT_TA_EXECUTION",
        message: `CP cannot be recorded when Ta was DNF`,
        path: cpPath,
      });
    } else if (ta.executed === "INC" && ta.testingPeriod === undefined) {
      diagnostics.push({
        code: "CP_WITHOUT_TA_TEST_PERIOD",
        message: `CP cannot be recorded when Ta was INC without testingPeriod`,
        path: cpPath,
      });
    }
  });

  return diagnostics;
}

function findPrecedingTa(contexts: readonly WeekContext[], currentIndex: number): Week | undefined {
  const current = contexts[currentIndex]!;

  for (let i = currentIndex - 1; i >= 0; i--) {
    const candidate = contexts[i]!;
    if (
      candidate.mesocycleIndex !== current.mesocycleIndex ||
      candidate.fractalIndex !== current.fractalIndex
    ) {
      break;
    }
    if (candidate.week.planned === "Ta") {
      return candidate.week;
    }
  }

  return undefined;
}
