import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "~/": `${path.resolve(__dirname, "./app")}/`,
    },
  },
  test: {
    globals: true,
    environment: "node",
    silent: true,
    include: [
      "./app/lib/**/*.test.ts",
      "./app/lib/**/*.test.js",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      exclude: ["**/build/**", "**/*.config.*"],
    },
  },
});
