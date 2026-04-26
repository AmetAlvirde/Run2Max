import type { PlanTemplate } from "./types.js";

const MESO_FRACTAL = ["L", "LL", "LLL", "D", "Ta", "Tb"];
const TAPER_FRACTAL = ["P", "P", "R", "N"];

const ONE_MESO: PlanTemplate = {
  name: "1-meso",
  description: "Single mesocycle with one load-test fractal (6 weeks).",
  mesocycles: [
    { name: "MESO-1", fractals: [MESO_FRACTAL] },
  ],
};

const TWO_MESO: PlanTemplate = {
  name: "2-meso",
  description: "Two mesocycles, each with one load-test fractal (12 weeks).",
  mesocycles: [
    { name: "MESO-1", fractals: [MESO_FRACTAL] },
    { name: "MESO-2", fractals: [MESO_FRACTAL] },
  ],
};

const TWO_MESO_RACE: PlanTemplate = {
  name: "2-meso-race",
  description: "Two build mesocycles plus taper/race/transition (16 weeks). Half-marathon default.",
  mesocycles: [
    { name: "MESO-1", fractals: [MESO_FRACTAL] },
    { name: "MESO-2", fractals: [MESO_FRACTAL] },
    { name: "TAPER", fractals: [TAPER_FRACTAL] },
  ],
};

const THREE_MESO_RACE: PlanTemplate = {
  name: "3-meso-race",
  description: "Three build mesocycles plus taper/race/transition (22 weeks). Marathon default.",
  mesocycles: [
    { name: "MESO-1", fractals: [MESO_FRACTAL] },
    { name: "MESO-2", fractals: [MESO_FRACTAL] },
    { name: "MESO-3", fractals: [MESO_FRACTAL] },
    { name: "TAPER", fractals: [TAPER_FRACTAL] },
  ],
};

const BRIDGE: PlanTemplate = {
  name: "bridge",
  description: "Short bridge block with a single load fractal, no test or race weeks (4 weeks).",
  mesocycles: [
    { name: "MESO-1", fractals: [["L", "LL", "LLL", "D"]] },
  ],
};

export const BUILTIN_TEMPLATES: PlanTemplate[] = [
  ONE_MESO,
  TWO_MESO,
  TWO_MESO_RACE,
  THREE_MESO_RACE,
  BRIDGE,
];

export function getBuiltinTemplate(name: string): PlanTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.name === name);
}
