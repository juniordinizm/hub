import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Ambas as suites limpam tabelas do banco descartável.
    // Executá-las em paralelo mistura fixtures e invalida as asserções de concorrência.
    fileParallelism: false,
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
  },
});
