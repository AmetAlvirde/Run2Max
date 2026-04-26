import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "plan",
    description: "Manage and inspect training plan",
  },
  subCommands: {
    create: () => import("./create.js").then((m) => m.default),
    status: () => import("./status.js").then((m) => m.default),
    sync: () => import("./sync.js").then((m) => m.default),
    validate: () => import("./validate.js").then((m) => m.default),
  },
});
