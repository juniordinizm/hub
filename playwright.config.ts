import { defineConfig, devices } from "@playwright/test";

const bunCommand = process.platform === "win32" ? "bun.cmd" : "bun";
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
const e2eObjectStorageEnvironment = {
  E2E_R2_BUCKET_NAME: "hub-e2e",
  R2_ACCESS_KEY_ID: "S3RVER",
  R2_ACCOUNT_ID: "e2e",
  R2_BUCKET_NAME: "hub-e2e",
  R2_ENDPOINT: "http://127.0.0.1:4568",
  R2_SECRET_ACCESS_KEY: "S3RVER",
} as const;

for (const [key, value] of Object.entries(e2eObjectStorageEnvironment)) {
  process.env[key] = value;
}

const serverCommand = process.env.CI
  ? `${bunCommand} scripts/e2e-next-server.ts`
  : `${bunCommand} run dev -- --port 3100`;

export default defineConfig({
  fullyParallel: false,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
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
  webServer: [
    {
      command: `${bunCommand} scripts/e2e-object-storage.ts`,
      name: "E2E object storage",
      reuseExistingServer: false,
      timeout: 30_000,
      url: e2eObjectStorageEnvironment.R2_ENDPOINT,
    },
    {
      command: serverCommand,
      env: {
        ...process.env,
        BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3100",
        BETTER_AUTH_URL: "http://127.0.0.1:3100",
        AUTH_PUBLIC_SIGNUP_ENABLED: "true",
        CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
        CI: "true",
        ...(e2eDatabaseUrl ? { DATABASE_URL: e2eDatabaseUrl } : {}),
        DATABASE_URL_DIRECT: "",
        E2E_TEST_MODE: "true",
        INTERNAL_BOOTSTRAP_SECRET: "",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
      },
      name: "Next.js",
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:3100",
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
