import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["db/integration/**/*.test.ts"],
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
