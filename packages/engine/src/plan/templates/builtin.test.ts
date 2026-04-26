import { describe, it, expect } from "vitest";
import { BUILTIN_TEMPLATES, getBuiltinTemplate } from "./builtin.js";
import { PLANNED_WEEK_TYPES } from "../schema.js";
import type { PlanTemplate } from "./types.js";

function countWeeks(template: PlanTemplate): number {
  return template.mesocycles.reduce(
    (sum, meso) =>
      sum + meso.fractals.reduce((fsum, fractal) => fsum + fractal.length, 0),
    0
  );
}

function allWeeks(template: PlanTemplate): string[] {
  return template.mesocycles.flatMap((meso) => meso.fractals.flat());
}

describe("BUILTIN_TEMPLATES", () => {
  it("exports 5 built-in templates", () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(5);
  });

  it("each template has a unique name", () => {
    const names = BUILTIN_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("each template has at least one mesocycle", () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.mesocycles.length).toBeGreaterThan(0);
    }
  });

  it("each mesocycle has at least one fractal with at least one week", () => {
    for (const template of BUILTIN_TEMPLATES) {
      for (const meso of template.mesocycles) {
        expect(meso.fractals.length).toBeGreaterThan(0);
        for (const fractal of meso.fractals) {
          expect(fractal.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("all week types in templates are valid planned types", () => {
    const valid = new Set(PLANNED_WEEK_TYPES);
    for (const template of BUILTIN_TEMPLATES) {
      for (const week of allWeeks(template)) {
        expect(valid.has(week as (typeof PLANNED_WEEK_TYPES)[number])).toBe(true);
      }
    }
  });
});

describe("getBuiltinTemplate", () => {
  it("returns template by name", () => {
    const t = getBuiltinTemplate("1-meso");
    expect(t).toBeDefined();
    expect(t?.name).toBe("1-meso");
  });

  it("returns undefined for unknown name", () => {
    expect(getBuiltinTemplate("does-not-exist")).toBeUndefined();
  });
});

describe("1-meso template", () => {
  it("has 6 weeks", () => {
    const t = getBuiltinTemplate("1-meso")!;
    expect(countWeeks(t)).toBe(6);
  });
});

describe("2-meso-race template", () => {
  it("has 16 weeks", () => {
    const t = getBuiltinTemplate("2-meso-race")!;
    expect(countWeeks(t)).toBe(16);
  });
});

describe("bridge template", () => {
  it("has no test or race weeks", () => {
    const t = getBuiltinTemplate("bridge")!;
    const forbidden = new Set(["Ta", "Tb", "P", "R", "N"]);
    for (const week of allWeeks(t)) {
      expect(forbidden.has(week)).toBe(false);
    }
  });
});
