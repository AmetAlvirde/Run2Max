import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "quantify",
    description: "Analyze a .fit file and produce structured run output",
  },
  args: {
    file: {
      type: "positional",
      description: "Path to the .fit file",
      required: true,
    },
  },
  run({ args }) {
    console.log(`Analyzing: ${args.file}`);
    console.log("Not yet implemented — coming in Phase 2.");
  },
});
