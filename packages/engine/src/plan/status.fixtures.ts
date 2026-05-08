import { parsePlan } from "./schema.js";

export function makeSingleFractalPlan(weeks: object[], extras?: object) {
  return parsePlan({
    schema_version: 1,
    block: "build",
    start: "2026-05-04",
    ...extras,
    mesocycles: [{ name: "CANAL", fractals: [{ weeks }] }],
  });
}

/**
 * Multi-mesocycle plan used for structural and full-view tests.
 * Week sequence (absolute index):
 *   CANAL / F1: L(1)ok  LL(2)ok  LLL(3)ok  D(4)ok  Ta(5)ok  Tb(6)ok
 *   CANAL / F2: L(7)current  LL(8)unsynced_past  LLL(9)unsynced_past
 *               D(10)future  Ta(11)future  Tb(12)future
 *   TAPER / F1: P(13).  P(14).  R(15).  N(16).
 *
 * TODAY = "2026-07-10"
 * week end dates after current:
 *   LL  starts 2026-06-22, end 2026-06-29 -> past   -> unsynced_past
 *   LLL starts 2026-06-29, end 2026-07-06 -> past   -> unsynced_past
 *   D   starts 2026-07-06, end 2026-07-13 -> >=TODAY -> future
 */
export function makeFullPlan() {
  return parsePlan({
    schema_version: 1,
    block: "build",
    goal: "Half Marathon Santiago",
    race_date: "2026-10-18",
    start: "2026-05-04",
    mesocycles: [
      {
        name: "CANAL",
        fractals: [
          {
            weeks: [
              { planned: "L", start: "2026-05-04", executed: "L" },
              { planned: "LL", start: "2026-05-11", executed: "LL" },
              { planned: "LLL", start: "2026-05-18", executed: "LLL" },
              { planned: "D", start: "2026-05-25", executed: "D" },
              { planned: "Ta", start: "2026-06-01", executed: "Ta" },
              { planned: "Tb", start: "2026-06-08", executed: "Tb" },
            ],
          },
          {
            weeks: [
              { planned: "L", start: "2026-06-15" },
              { planned: "LL", start: "2026-06-22" },
              { planned: "LLL", start: "2026-06-29" },
              { planned: "D", start: "2026-07-06" },
              { planned: "Ta", start: "2026-07-13" },
              { planned: "Tb", start: "2026-07-20" },
            ],
          },
        ],
      },
      {
        name: "TAPER",
        fractals: [
          {
            weeks: [
              { planned: "P", start: "2026-10-04" },
              { planned: "P", start: "2026-10-11" },
              { planned: "R", start: "2026-10-18" },
              { planned: "N", start: "2026-10-25" },
            ],
          },
        ],
      },
    ],
  });
}
