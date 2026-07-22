import { defineConfig, devices } from "@playwright/test";

const bunCommand = process.platform === "win32" ? "bun.cmd" : "bun";
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
const serverCommand = process.env.CI
  ? `${bunCommand} run build && ${bunCommand} run start -- --port 3100`
  : `${bunCommand} run dev -- --port 3100`;

export default defineConfig({
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  outputDir: "test-results/playwright",
  reporter: process.env.CI
    ? [
        ["github"],
        ["json", { outputFile: "test-results/playwright/results.json" }],
        ["html", { open: "never" }],
      ]
    : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: serverCommand,
    env: {
      ...process.env,
      BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3100",
      BETTER_AUTH_URL: "http://127.0.0.1:3100",
      CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
      CI: "true",
      ...(e2eDatabaseUrl ? { DATABASE_URL: e2eDatabaseUrl } : {}),
      E2E_TEST_MODE: "true",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
    },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3100",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
