import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CURRENT_BUN_EXECUTABLE = /execFileAsync\(\s*process\.execPath/;
const BUN_COMMAND_NAME = /execFileAsync\(\s*"bun"/;
const githubExpression = (expression: string): string =>
  ["$", "{{ ", expression, " }}"].join("");

describe("Staging operations", () => {
  it("reuses the current Bun executable when seeding after a reset", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../scripts/reset-staging.ts"),
      "utf8"
    );

    expect(script).toMatch(CURRENT_BUN_EXECUTABLE);
    expect(script).not.toMatch(BUN_COMMAND_NAME);
  });

  it("runs every five-minute inbox worker in the Staging scheduler", () => {
    const workflow = readFileSync(
      resolve(
        import.meta.dirname,
        "../../.github/workflows/run-staging-jobs.yml"
      ),
      "utf8"
    );

    expect(workflow).toContain('"*/5 * * * *"');
    expect(workflow).toContain('call_job "/api/cron/asaas-webhooks"');
    expect(workflow).toContain('call_job "/api/cron/outbox"');
    expect(workflow).toContain('call_job "/api/cron/jmvstream"');
    expect(workflow).toContain('call_job "/api/cron/resend-webhooks"');
  });

  it("gates the controlled Resend lifecycle proof inside vercel-staging", () => {
    const workflow = readFileSync(
      resolve(
        import.meta.dirname,
        "../../.github/workflows/run-staging-jobs.yml"
      ),
      "utf8"
    );

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("verify-resend-lifecycle");
    expect(workflow).toContain("SEND_CONTROLLED_STAGING_PASSWORD_RESET");
    expect(workflow).toContain("name: vercel-staging");
    expect(workflow).toContain("ref: staging");
    expect(workflow).toContain(
      `DATABASE_URL_DIRECT: ${githubExpression("secrets.DATABASE_URL_DIRECT")}`
    );
    expect(workflow).toContain(
      `STAGING_ADMIN_EMAIL: ${githubExpression("secrets.STAGING_ADMIN_EMAIL")}`
    );
    expect(workflow).toContain(
      `CRON_SECRET: ${githubExpression("secrets.CRON_SECRET")}`
    );
    expect(workflow).toContain(
      "bun run ops:check:resend-lifecycle:staging -- --execute"
    );
    expect(workflow).not.toContain("vercel-production");
    expect(workflow).not.toContain("db:migrate");
  });
});
