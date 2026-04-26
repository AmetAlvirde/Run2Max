import { defineCommand } from "citty";
import { join } from "node:path";
import { loadPlan, getPlanStatus, formatDefaultView, formatFullView } from "@run2max/engine";

export default defineCommand({
  meta: {
    name: "status",
    description: "Show training plan status (current week focus or --full block overview)",
  },
  args: {
    dir: {
      type: "string",
      description: "Directory containing plan.yaml (defaults to current directory)",
      required: false,
    },
    full: {
      type: "boolean",
      description: "Show full block structural overview",
      default: false,
    },
  },

  async run({ args }) {
    const dir = args.dir ?? process.cwd();
    const filePath = join(dir, "plan.yaml");

    let plan;
    try {
      plan = await loadPlan(filePath);
    } catch (err) {
      console.error(`error: ${(err as Error).message}`);
      process.exit(1);
    }

    const status = getPlanStatus(plan);
    const output = args.full ? formatFullView(status) : formatDefaultView(status);
    console.log(output);
  },
});
