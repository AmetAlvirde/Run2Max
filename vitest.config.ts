import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the workspace engine to its source so cross-package tests
      // (e.g. the CLI integration tests) run against current source rather than
      // a possibly-stale built `dist`. Tests that fully mock the module via
      // `vi.mock("@run2max/engine")` are unaffected.
      "@run2max/engine": fileURLToPath(
        new URL("./packages/engine/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
  },
});
