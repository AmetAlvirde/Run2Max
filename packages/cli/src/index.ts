import { defineCommand, runMain } from "citty";
import { ENGINE_VERSION } from "@run2max/engine";

const main = defineCommand({
  meta: {
    name: "run2max",
    version: "1.0.0",
    description: "Structured run analysis from .fit files",
  },
  subCommands: {
    quantify: () => import("./commands/quantify.js").then((m) => m.default),
    plan: () => import("./commands/plan/index.js").then((m) => m.default),
  },
});

runMain(main);
