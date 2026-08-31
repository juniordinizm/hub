import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readWorkflow = (fileName: string): string =>
  readFileSync(
    resolve(import.meta.dirname, `../../.github/workflows/${fileName}`),
    "utf8"
  );

describe("CI and deployment workflow contracts", () => {
  it("runs CI only for pull requests and manual verification", () => {
    const workflow = readWorkflow("ci.yml");

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("branches: [main, staging]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("name: CI");
    expect(workflow).not.toContain("\n  push:");
    expect(workflow).not.toContain("NEON_CI_API_KEY");
    expect(workflow).not.toContain("create-neon-branch");
    expect(workflow).not.toContain("delete-neon-branch");
    expect(workflow.match(/bun install --frozen-lockfile/g)).toHaveLength(1);
  });

  it("runs integration and E2E against separate local PostgreSQL databases", () => {
    const workflow = readWorkflow("ci.yml");

    expect(workflow).toContain("services:");
    expect(workflow).toContain("postgres:18-alpine");
    expect(workflow).toContain("create database hub_integration");
    expect(workflow).toContain("create database hub_e2e");
    expect(workflow).toContain(
      "postgresql://postgres:postgres@127.0.0.1:5432/hub_integration?sslmode=disable"
    );
    expect(workflow).toContain(
      "postgresql://postgres:postgres@127.0.0.1:5432/hub_e2e?sslmode=disable"
    );
    expect(workflow).toContain("bun run db:migrate:e2e");
    expect(workflow).toContain("bun run test:certificates:integration");
    expect(workflow).toContain("bun run test:e2e");
    expect(workflow).toContain("bun run build");
    expect(workflow).toContain("bun run knip");
  });

  it("migrates Staging after its branch changes but never deploys from Actions", () => {
    const workflow = readWorkflow("deploy-staging.yml");

    expect(workflow).toContain("push:");
    expect(workflow).toContain("branches: [staging]");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).toContain("bun run db:migrate:staging");
    expect(workflow).not.toContain("vercel deploy");
    expect(workflow).toContain("preview.neurocapacitar.com.br");
    expect(workflow).toContain("api/health/ready");
  });

  it("creates a reconciliation PR when main contains Production-only changes", () => {
    const workflow = readWorkflow("prepare-production-release.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("sync/production-into-staging-");
    expect(workflow).toContain("git merge --no-edit origin/main");
    expect(workflow).toContain("git merge --abort");
    expect(workflow).toContain("gh workflow run ci.yml");
    expect(workflow).toContain("--base staging");
    expect(workflow).toContain("gh pr create");
  });

  it("releases Staging or a validated hotfix and never skips the staged Production deployment", () => {
    const workflow = readWorkflow("deploy-vercel.yml");

    expect(workflow).toContain("mode:");
    expect(workflow).toContain("release-staging");
    expect(workflow).toContain("hotfix");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("git push origin");
    expect(workflow).toContain("Await automatic Production deployment");
    expect(workflow).toContain("contents: write");
    expect(workflow).toContain(
      "name: Require a recent independent Production backup"
    );
    expect(workflow).toContain(
      "if: steps.release.outputs.has_migrations == 'true'"
    );
    expect(workflow).not.toContain("release_sha:");
    expect(workflow).not.toContain("confirm_production:");
    expect(workflow).not.toContain("EMERGENCY_SKIP_PRODUCTION");
  });

  it("keeps the JMVStream schedule at fifteen minutes", () => {
    const vercel = readFileSync(
      resolve(import.meta.dirname, "../../vercel.json"),
      "utf8"
    );
    const stagingJobs = readWorkflow("run-staging-jobs.yml");

    expect(vercel).toContain('"path": "/api/cron/jmvstream"');
    expect(vercel).toContain('"schedule": "*/15 * * * *"');
    expect(stagingJobs).toContain('call_job "/api/cron/jmvstream"');
    expect(stagingJobs).not.toContain('cron: "*/5 * * * *"');
  });
});
