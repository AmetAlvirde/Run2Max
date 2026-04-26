import type { PlanTemplate } from "./templates/types.js";
import type { Plan } from "./schema.js";

export interface ReconcileOptions {
  template: PlanTemplate;
  start: string;
  raceDate: string;
  distance?: string;
  weekStart?: string;
  block?: string;
  goal?: string;
  strategy?: string;
}

export interface CompressionOption {
  strategies: string[];
  description: string;
  weeksRemoved: number;
  warnings: string[];
  plan: Plan;
}

export interface ReconciliationResult {
  fit: "exact" | "overflow" | "underflow";
  availableWeeks: number;
  templateWeeks: number;
  options: CompressionOption[];
  plan: Plan | null;
}

// ─── date helpers ─────────────────────────────────────────────────────────────

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

function weekStartOf(dateStr: string, weekStartDay = "monday"): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const target = DAY_NUMBERS[weekStartDay] ?? 1;
  const current = d.getUTCDay();
  const diff = (current - target + 7) % 7;
  return addDays(dateStr, -diff);
}

function daysBetween(from: string, to: string): number {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) /
      86400000
  );
}

// ─── template helpers ─────────────────────────────────────────────────────────

function cloneTemplate(t: PlanTemplate): PlanTemplate {
  return {
    name: t.name,
    description: t.description,
    mesocycles: t.mesocycles.map((m) => ({
      name: m.name,
      fractals: m.fractals.map((f) => [...f]),
    })),
  };
}

function flatWeeks(template: PlanTemplate): string[] {
  return template.mesocycles.flatMap((m) => m.fractals.flatMap((f) => f));
}

function raceIndex(template: PlanTemplate): number {
  return flatWeeks(template).lastIndexOf("R");
}

function weeksBeforeR(template: PlanTemplate): number {
  const ri = raceIndex(template);
  return ri === -1 ? flatWeeks(template).length : ri + 1;
}

function isTaperFractal(fractal: string[]): boolean {
  return fractal.some((w) => w === "P" || w === "R" || w === "N");
}

// ─── plan generation ──────────────────────────────────────────────────────────

function buildPlan(template: PlanTemplate, opts: ReconcileOptions): Plan {
  const weekStartDay = opts.weekStart ?? "monday";
  const raceWeekStart = weekStartOf(opts.raceDate, weekStartDay);
  const ri = raceIndex(template);

  let flatIdx = 0;
  const mesocycles = template.mesocycles.map((m) => ({
    name: m.name,
    fractals: m.fractals.map((f) => ({
      weeks: f.map((weekType) => {
        const start = addDays(raceWeekStart, (flatIdx - ri) * 7);
        flatIdx++;
        return { planned: weekType, start };
      }),
    })),
  }));

  const planStart = addDays(raceWeekStart, -ri * 7);

  return {
    schemaVersion: 1,
    block: opts.block ?? "build",
    ...(opts.goal !== undefined && { goal: opts.goal }),
    ...(opts.distance !== undefined && { distance: opts.distance }),
    raceDate: opts.raceDate,
    start: planStart,
    mesocycles,
  };
}

// ─── compression strategies ───────────────────────────────────────────────────

type StrategyResult = { template: PlanTemplate; warnings: string[] };

function shortenTaper(template: PlanTemplate): StrategyResult | null {
  const t = cloneTemplate(template);
  for (let mi = t.mesocycles.length - 1; mi >= 0; mi--) {
    const meso = t.mesocycles[mi]!;
    for (let fi = meso.fractals.length - 1; fi >= 0; fi--) {
      const f = meso.fractals[fi]!;
      if (!f.includes("R")) continue;
      if (f.filter((w) => w === "P").length >= 2) {
        const idx = f.indexOf("P");
        meso.fractals[fi] = [...f.slice(0, idx), ...f.slice(idx + 1)];
        return { template: t, warnings: [] };
      }
      return null;
    }
  }
  return null;
}

function reduceTransition(template: PlanTemplate): StrategyResult | null {
  const t = cloneTemplate(template);
  for (let mi = t.mesocycles.length - 1; mi >= 0; mi--) {
    const meso = t.mesocycles[mi]!;
    for (let fi = meso.fractals.length - 1; fi >= 0; fi--) {
      const f = meso.fractals[fi]!;
      if (!f.includes("R")) continue;
      const lastN = f.reduce((acc, w, i) => (w === "N" ? i : acc), -1);
      if (lastN !== -1) {
        meso.fractals[fi] = [...f.slice(0, lastN), ...f.slice(lastN + 1)];
        return { template: t, warnings: [] };
      }
      return null;
    }
  }
  return null;
}

function shortenFractal(template: PlanTemplate): StrategyResult | null {
  const t = cloneTemplate(template);
  for (let mi = 0; mi < t.mesocycles.length; mi++) {
    const meso = t.mesocycles[mi]!;
    for (let fi = 0; fi < meso.fractals.length; fi++) {
      const f = meso.fractals[fi]!;
      if (isTaperFractal(f)) continue;
      if (f.includes("LLL")) {
        const idx = f.lastIndexOf("LLL");
        meso.fractals[fi] = [...f.slice(0, idx), ...f.slice(idx + 1)];
        return { template: t, warnings: [] };
      }
      if (f.includes("LL")) {
        const idx = f.lastIndexOf("LL");
        const newF = [...f.slice(0, idx), ...f.slice(idx + 1)];
        if (newF.includes("L") && newF.includes("D")) {
          meso.fractals[fi] = newF;
          return { template: t, warnings: [] };
        }
      }
    }
  }
  return null;
}

function reduceTesting(template: PlanTemplate, distance?: string): StrategyResult | null {
  const t = cloneTemplate(template);
  const keepTb = distance !== "5k" && distance !== "10k";
  const removeType = keepTb ? "Ta" : "Tb";
  const warnings = keepTb
    ? ["CP calculation may become outdated without Ta execution."]
    : [];

  for (let mi = 0; mi < t.mesocycles.length; mi++) {
    const meso = t.mesocycles[mi]!;
    for (let fi = 0; fi < meso.fractals.length; fi++) {
      const f = meso.fractals[fi]!;
      if (isTaperFractal(f)) continue;
      if (f.includes("Ta") && f.includes("Tb")) {
        const idx = f.indexOf(removeType);
        meso.fractals[fi] = [...f.slice(0, idx), ...f.slice(idx + 1)];
        return { template: t, warnings };
      }
    }
  }
  return null;
}

function skipTesting(template: PlanTemplate): StrategyResult | null {
  const t = cloneTemplate(template);
  let removed = 0;
  for (const meso of t.mesocycles) {
    for (let fi = 0; fi < meso.fractals.length; fi++) {
      const f = meso.fractals[fi]!;
      if (isTaperFractal(f)) continue;
      const filtered = f.filter((w) => w !== "Ta" && w !== "Tb");
      removed += f.length - filtered.length;
      meso.fractals[fi] = filtered;
    }
  }
  if (removed === 0) return null;
  return {
    template: t,
    warnings: ["Race predictions may become outdated without testing periods."],
  };
}

function dropFractal(template: PlanTemplate): StrategyResult | null {
  const t = cloneTemplate(template);
  for (let mi = t.mesocycles.length - 1; mi >= 0; mi--) {
    const meso = t.mesocycles[mi]!;
    const isTaper = meso.fractals.some((f) => isTaperFractal(f));
    if (!isTaper && meso.fractals.length > 0) {
      meso.fractals = meso.fractals.slice(0, -1);
      if (meso.fractals.length === 0) {
        t.mesocycles.splice(mi, 1);
      }
      return { template: t, warnings: [] };
    }
  }
  return null;
}

// ─── strategy registry ────────────────────────────────────────────────────────

const STRATEGY_NAMES = [
  "shorten-taper",
  "reduce-transition",
  "shorten-fractal",
  "reduce-testing",
  "skip-testing",
  "drop-fractal",
] as const;

type StrategyName = (typeof STRATEGY_NAMES)[number];

function applyOne(
  template: PlanTemplate,
  name: string,
  distance?: string
): StrategyResult | null {
  switch (name as StrategyName) {
    case "shorten-taper":
      return shortenTaper(template);
    case "reduce-transition":
      return reduceTransition(template);
    case "shorten-fractal":
      return shortenFractal(template);
    case "reduce-testing":
      return reduceTesting(template, distance);
    case "skip-testing":
      return skipTesting(template);
    case "drop-fractal":
      return dropFractal(template);
    default:
      return null;
  }
}

function applyCombo(
  template: PlanTemplate,
  names: string[],
  distance?: string
): StrategyResult | null {
  let t = template;
  const allWarnings: string[] = [];
  for (const name of names) {
    const r = applyOne(t, name, distance);
    if (!r) return null;
    t = r.template;
    allWarnings.push(...r.warnings);
  }
  return { template: t, warnings: allWarnings };
}

function parseStrategy(strategy: string): string[] {
  return strategy.split("+").map((p) => {
    const n = parseInt(p.trim(), 10);
    if (!isNaN(n) && n >= 1 && n <= STRATEGY_NAMES.length) {
      return STRATEGY_NAMES[n - 1]!;
    }
    return p.trim();
  });
}

function disruptionScore(names: string[]): number {
  return names.reduce((sum, n) => sum + STRATEGY_NAMES.indexOf(n as StrategyName), 0);
}

// ─── option generation ────────────────────────────────────────────────────────

function generateOptions(
  template: PlanTemplate,
  availableWeeks: number,
  opts: ReconcileOptions
): CompressionOption[] {
  const originalTotal = flatWeeks(template).length;
  const results: CompressionOption[] = [];
  const seen = new Set<string>();

  function tryCombo(names: string[]): void {
    const key = [...names].sort().join("+");
    if (seen.has(key)) return;
    seen.add(key);

    const r = applyCombo(cloneTemplate(template), names, opts.distance);
    if (!r) return;
    if (weeksBeforeR(r.template) > availableWeeks) return;

    const plan = buildPlan(r.template, opts);
    results.push({
      strategies: names,
      description: names.join(" + "),
      weeksRemoved: originalTotal - flatWeeks(r.template).length,
      warnings: r.warnings,
      plan,
    });
  }

  // Single strategies
  for (const s of STRATEGY_NAMES) {
    tryCombo([s]);
  }

  // Pairs (including post-race strategies combined with pre-race fixers)
  for (let i = 0; i < STRATEGY_NAMES.length; i++) {
    for (let j = i + 1; j < STRATEGY_NAMES.length; j++) {
      tryCombo([STRATEGY_NAMES[i]!, STRATEGY_NAMES[j]!]);
    }
  }

  // Triples — only if nothing found yet
  if (results.length === 0) {
    for (let i = 0; i < STRATEGY_NAMES.length; i++) {
      for (let j = i + 1; j < STRATEGY_NAMES.length; j++) {
        for (let k = j + 1; k < STRATEGY_NAMES.length; k++) {
          tryCombo([STRATEGY_NAMES[i]!, STRATEGY_NAMES[j]!, STRATEGY_NAMES[k]!]);
        }
      }
    }
  }

  results.sort((a, b) => {
    if (a.strategies.length !== b.strategies.length) return a.strategies.length - b.strategies.length;
    return disruptionScore(a.strategies) - disruptionScore(b.strategies);
  });

  return results;
}

// ─── main export ──────────────────────────────────────────────────────────────

export function reconcile(opts: ReconcileOptions): ReconciliationResult {
  const weekStartDay = opts.weekStart ?? "monday";
  const raceWeekStart = weekStartOf(opts.raceDate, weekStartDay);
  const daysToRace = daysBetween(opts.start, raceWeekStart);
  const availableWeeks = daysToRace / 7 + 1;
  const templateWeeks = flatWeeks(opts.template).length;
  const needed = weeksBeforeR(opts.template) - availableWeeks;

  if (needed === 0) {
    return {
      fit: "exact",
      availableWeeks,
      templateWeeks,
      options: [],
      plan: buildPlan(opts.template, opts),
    };
  }

  if (needed < 0) {
    return {
      fit: "underflow",
      availableWeeks,
      templateWeeks,
      options: [],
      plan: buildPlan(opts.template, opts),
    };
  }

  // Overflow — try user-provided strategy first
  if (opts.strategy !== undefined) {
    const names = parseStrategy(opts.strategy);
    const r = applyCombo(cloneTemplate(opts.template), names, opts.distance);
    if (r && weeksBeforeR(r.template) <= availableWeeks) {
      const newNeeded = weeksBeforeR(r.template) - availableWeeks;
      const fit = newNeeded === 0 ? "exact" : "underflow";
      return {
        fit,
        availableWeeks,
        templateWeeks,
        options: [],
        plan: buildPlan(r.template, opts),
      };
    }
  }

  const options = generateOptions(opts.template, availableWeeks, opts);
  return { fit: "overflow", availableWeeks, templateWeeks, options, plan: null };
}
