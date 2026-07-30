import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const bunExecutable = process.platform === "win32" ? "bun.cmd" : "bun";
const launcherPath = resolve(
  import.meta.dirname,
  "../../scripts/run-development.ts"
);

const developmentEnvironment = `
DATABASE_URL=postgresql://user:password@ep-development-pooler.example.com/neondb
DATABASE_URL_DIRECT=postgresql://user:password@ep-development.example.com/neondb
DEVELOPMENT_DATABASE_HOST=ep-development.example.com
BETTER_AUTH_URL=http://127.0.0.1:3000
CERTIFICATE_PUBLIC_BASE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
R2_BUCKET_NAME=hub-development-private
R2_PUBLIC_BUCKET_NAME=hub-development-public
R2_ACCESS_KEY_ID=development-access-key
R2_ACCOUNT_ID=development-account
R2_PUBLIC_BASE_URL=https://public-development.example.com
R2_SECRET_ACCESS_KEY=development-secret-key
DEVELOPMENT_EMAIL_RECIPIENT_ALLOWLIST=developer@example.com
RESEND_API_KEY=re_development
RESEND_FROM_EMAIL=Hub <notificacoes@neurocapacitar.com.br>
SUPPORT_EMAIL=suporte@example.com
DEVELOPMENT_ABACATEPAY_DEV_MODE=true
ABACATE_PAY_API_KEY=abacatepay-development
ABACATEPAY_WEBHOOK_SECRET=abacatepay-webhook-development
ASAAS_API_BASE_URL=https://api-sandbox.asaas.com
ASAAS_API_KEY=\\$aact_hmlg_literal_value
ASAAS_USER_AGENT=hub-development-test
ASAAS_WEBHOOK_TOKEN=asaas-webhook-token-with-thirty-two-characters
JMVSTREAM_PLAN_ID=OD-DEVELOPMENT
DEVELOPMENT_JMVSTREAM_PLAN_ID=OD-DEVELOPMENT
JMVSTREAM_AUTH_RESOURCE=development-resource
DEVELOPMENT_SENTRY_PROJECT_ID=123456
SENTRY_DSN=https://public@example.ingest.sentry.io/123456
NEXT_PUBLIC_SENTRY_DSN=https://public@example.ingest.sentry.io/123456
BETTER_AUTH_SECRET=better-auth-development-secret-value
CRON_SECRET=cron-development-secret-value-1234
HEALTHCHECK_SECRET=healthcheck-development-secret-value
E2E_TEST_MODE=false
SCHEDULED_JOBS_ENABLED=true
`.trim();

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (directory) => {
      await rm(directory, { force: true, recursive: true });
    })
  );
});

describe("Development launcher", () => {
  it("preserves a literal Asaas API key in the child process", async () => {
    const directory = await mkdtemp(
      resolve(tmpdir(), "hub-development-launcher-")
    );
    temporaryDirectories.push(directory);
    const probePath = resolve(directory, "probe.ts");

    await writeFile(resolve(directory, ".env.local"), developmentEnvironment);
    await writeFile(
      probePath,
      `
        process.stdout.write(
          "ASAAS_API_KEY_PRESERVED=" +
            String(process.env.ASAAS_API_KEY === "$aact_hmlg_literal_value")
        );
      `.trim()
    );

    const environment = { ...process.env };
    for (const line of developmentEnvironment.split("\n")) {
      delete environment[line.slice(0, line.indexOf("="))];
    }

    const result = spawnSync(bunExecutable, [launcherPath, "bun", probePath], {
      cwd: directory,
      encoding: "utf8",
      env: environment,
      shell: process.platform === "win32",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ASAAS_API_KEY_PRESERVED=true");
  });

  it("preserves explicit isolated E2E overrides over the local environment", async () => {
    const directory = await mkdtemp(
      resolve(tmpdir(), "hub-development-launcher-")
    );
    temporaryDirectories.push(directory);
    const probePath = resolve(directory, "probe.ts");
    const e2eDatabaseUrl =
      "postgresql://user:password@ep-e2e-pooler.example.com/neondb";

    await writeFile(resolve(directory, ".env.local"), developmentEnvironment);
    await writeFile(
      probePath,
      `
        process.stdout.write(
          "E2E_OVERRIDES_PRESERVED=" +
            String(
              process.env.E2E_TEST_MODE === "true" &&
              process.env.R2_ENDPOINT === "http://127.0.0.1:4568"
            )
        );
      `.trim()
    );

    const environment = {
      ...process.env,
      CI: "true",
      DATABASE_URL: e2eDatabaseUrl,
      E2E_DATABASE_URL: e2eDatabaseUrl,
      E2E_R2_BUCKET_NAME: "hub-e2e",
      E2E_TEST_MODE: "true",
      R2_BUCKET_NAME: "hub-e2e",
      R2_ENDPOINT: "http://127.0.0.1:4568",
    };
    const result = spawnSync(bunExecutable, [launcherPath, "bun", probePath], {
      cwd: directory,
      encoding: "utf8",
      env: environment,
      shell: process.platform === "win32",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("E2E_OVERRIDES_PRESERVED=true");
  });
});
