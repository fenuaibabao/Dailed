import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    server: { deps: { inline: ["convex-test"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "convex",
          include: ["tests/convex/**/*.test.ts"],
          environment: "edge-runtime",
          setupFiles: ["tests/convex/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
