import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "app/today/page.tsx",
        "app/api/session/today/route.ts",
        "app/api/session/start/route.ts",
      ],
      thresholds: {
        lines: 70,
        branches: 60,
      },
    },
  },
});
