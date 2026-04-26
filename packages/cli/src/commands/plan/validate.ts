import { defineCommand } from "citty";
import { join } from "node:path";
import { loadPlan, validatePlan } from "@run2max/engine";
import type { Diagnostic } from "@run2max/engine";

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate plan.yaml structure and semantics",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to plan.yaml (defaults to ./plan.yaml)",
      required: false,
    },
  },

  async run({ args }) {
    const filePath = args.file ?? join(process.cwd(), "plan.yaml");

    let plan;
    try {
      plan = await loadPlan(filePath);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exit(1);
    }

    const diagnostics: Diagnostic[] = validatePlan(plan);

    for (const d of diagnostics) {
      const loc = d.path ? ` (${d.path})` : "";
      console.error(`error: ${d.message}${loc}`);
    }

    const errorCount = diagnostics.length;

    if (errorCount > 0) {
      const noun = errorCount === 1 ? "error" : "errors";
      console.error(`${errorCount} ${noun}`);
      process.exit(1);
    }

    console.log("plan.yaml is valid");
  },
});
