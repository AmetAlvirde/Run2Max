import { defineCommand } from "citty";
import {
  computeRunComparison,
  formatRunComparison,
  loadRunComparisonSide,
} from "@run2max/engine";
import type { RunComparisonSide } from "@run2max/engine";

function fatal(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

export default defineCommand({
  meta: {
    name: "compare",
    description:
      "Compare two saved Analysis Artifacts (baseline and comparand) as a Run Comparison",
  },
  args: {
    baseline: {
      type: "positional",
      description: "Path to the baseline Analysis Artifact (.yaml or .json)",
      required: true,
    },
    comparand: {
      type: "positional",
      description: "Path to the comparand Analysis Artifact (.yaml or .json)",
      required: true,
    },
  },

  async run({ args }) {
    let baseline: RunComparisonSide;
    let comparand: RunComparisonSide;

    try {
      baseline = await loadRunComparisonSide(args.baseline);
    } catch (err) {
      fatal(`Could not read baseline "${args.baseline}": ${(err as Error).message}`);
    }

    try {
      comparand = await loadRunComparisonSide(args.comparand);
    } catch (err) {
      fatal(`Could not read comparand "${args.comparand}": ${(err as Error).message}`);
    }

    const comparison = computeRunComparison(baseline, comparand);
    process.stdout.write(formatRunComparison(comparison));
  },
});
