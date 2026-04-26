import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "plan",
    description: "Manage and inspect training plan",
  },
  subCommands: {
    validate: () => import("./validate.js").then((m) => m.default),
  },
});
