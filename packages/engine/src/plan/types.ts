export interface TestingPeriod {
  cp?: number;
  eFtp?: number;
  lthr?: number;
  zones?: Record<string, { min: number; max: number }>;
}

export interface Week {
  planned: string;
  start: string;
  executed?: string;
  reason?: string;
  note?: string;
  testingPeriod?: TestingPeriod;
}

export interface Fractal {
  weeks: Week[];
}

export interface Mesocycle {
  name: string;
  fractals: Fractal[];
}

export interface Plan {
  schemaVersion: 1;
  block: string;
  goal?: string;
  distance?: string;
  raceDate?: string;
  start: string;
  mesocycles: Mesocycle[];
}
