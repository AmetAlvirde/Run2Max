export interface PlanTemplate {
  name: string;
  description: string;
  mesocycles: {
    name: string;
    fractals: string[][];
  }[];
}
