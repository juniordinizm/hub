import { defineConfig, devices } from "@playwright/test";
import { assertSafeE2eDatabaseEnvironment } from "./src/db/e2e-database-guard";

const bunCommand = process.platform === "win32" ? "bun.cmd" : "bun";
const e2eDatabaseUrl = process.env.E2E_DATABASE_URL;
if (!e2eDatabaseUrl) {
  throw new Error(
    "E2E_DATABASE_URL is required for the disposable E2E database."
  );
}
assertSafeE2eDatabaseEnvironment({
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL?.trim() || e2eDatabaseUrl,
  E2E_DATABASE_URL: e2eDatabaseUrl,
});
const e2eObjectStorageEnvironment = {
  E2E_R2_BUCKET_NAME: "hub-e2e",
  R2_ACCESS_KEY_ID: "S3RVER",
  R2_ACCOUNT_ID: "e2e",
  R2_BUCKET_NAME: "hub-e2e",
  R2_ENDPOINT: "http://127.0.0.1:4568",
  R2_PUBLIC_BASE_URL: "http://127.0.0.1:4568/hub-e2e",
  R2_SECRET_ACCESS_KEY: "S3RVER",
} as const;
const e2eApplicationEnvironment = {
  ASAAS_API_BASE_URL: "http://127.0.0.1:4570",
  ASAAS_API_KEY: "e2e-asaas-access-token",
  ASAAS_USER_AGENT: "hub-e2e/1.0",
  ASAAS_WEBHOOK_ENABLED: "true",
  ASAAS_WEBHOOK_TOKEN: "e2e-webhook-token-with-at-least-32-characters",
  AUTH_PUBLIC_SIGNUP_ENABLED: "true",
  BETTER_AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:3100",
  BETTER_AUTH_URL: "http://127.0.0.1:3100",
  CERTIFICATE_PUBLIC_BASE_URL: "http://127.0.0.1:3100",
  CI: "true",
  DATABASE_URL: e2eDatabaseUrl,
  DATABASE_URL_DIRECT: "",
  E2E_TEST_MODE: "true",
  CRON_SECRET: "e2e-cron-secret",
  INTERNAL_BOOTSTRAP_SECRET: "",
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
  NEXT_PUBLIC_E2E_TEST_MODE: "true",
  PAYMENTS_CHECKOUT_MODE: "public",
  SCHEDULED_JOBS_ENABLED: "true",
} as const;

for (const [key, value] of Object.entries(e2eObjectStorageEnvironment)) {
  process.env[key] = value;
}
Object.assign(process.env, e2eApplicationEnvironment);

const serverCommand = process.env.CI
  ? `${bunCommand} scripts/e2e-next-server.ts`
  : `${bunCommand} run dev -- --port 3100`;

export default defineConfig({
  expect: {
    timeout: 30_000,
  },
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
  timeout: 120_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  workers: 1,
  webServer: [
    {
      command: `${bunCommand} scripts/e2e-asaas.ts`,
      name: "E2E Asaas",
      reuseExistingServer: false,
      timeout: 30_000,
      url: "http://127.0.0.1:4570/checkout/health",
    },
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
        ...e2eApplicationEnvironment,
      },
      name: "Next.js",
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://127.0.0.1:3100",
    },
  ],
  projects: [
    {
      grepInvert: /@mobile-only/,
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      grep: /@mobile/,
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
