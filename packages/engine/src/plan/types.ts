export interface TestingPeriod {
  cp?: number;
  eFtp?: number;
  lthr?: number;
  zones?: Record<string, { min: number; max: number }>;
}

export interface TargetRange {
  metric: "power";
  min: number;
  max: number;
  unit: "W";
}

export type PrescribedStepTarget =
  | { kind: "distance"; value: number; unit: "km" }
  | { kind: "duration"; value: number; unit: "seconds" };

export interface PrescribedStep {
  index: number;
  target: PrescribedStepTarget;
  intensityLabel?: string;
  targetRange?: TargetRange;
  source: string;
}

export interface PrescribedRun {
  localDate: string;
  label: string;
  prescription: string;
  comparisonGroup?: string;
  steps: PrescribedStep[];
}

export interface Week {
  planned: string;
  start: string;
  executed?: string;
  reason?: string;
  note?: string;
  testingPeriod?: TestingPeriod;
  prescribedRuns?: PrescribedRun[];
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
