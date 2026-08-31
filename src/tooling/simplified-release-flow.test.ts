import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");

const read = (relativePath: string): string =>
  readFileSync(resolve(root, relativePath), "utf8");

describe("simplified release flow", () => {
  it("runs one pull-request CI with local PostgreSQL and no Neon CI branches", () => {
    const workflow = read(".github/workflows/ci.yml");

    expect(workflow).toContain("pull_request:");
    expect(workflow).not.toContain("push:");
    expect(workflow).toContain("services:");
    expect(workflow).toContain("postgres:18");
    expect(workflow).toContain("name: CI");
    expect(workflow).toContain(
      "postgresql://postgres:postgres@127.0.0.1:5432/hub_integration?sslmode=disable"
    );
    expect(workflow).toContain(
      "postgresql://postgres:postgres@127.0.0.1:5432/hub_e2e?sslmode=disable"
    );
    expect(workflow).not.toContain("NEON_CI_API_KEY");
    expect(workflow).not.toContain("create-neon-branch");
    expect(workflow).not.toContain("delete-neon-branch");
    expect(workflow).not.toContain("db:prepare:ci-migration");
  });

  it("rejects normal PRs targeting main and documents the allowed exception", () => {
    const workflow = read(".github/workflows/ci.yml");
    const template = read(".github/pull_request_template.md");

    expect(workflow).toContain("name: Enforce the pull request flow");
    expect(workflow).toContain("PR_BASE_BRANCH");
    expect(workflow).toContain("PR_HEAD_BRANCH");
    expect(workflow).toContain("^hotfix/");
    expect(workflow).toContain([",", "$", "{PR_LABELS},"].join(""));
    expect(workflow).toContain("PRs normais devem usar staging como base");
    expect(template).toContain("PR normal: base `staging`");
    expect(template).toContain("branch `hotfix/*`, base `main`");
    expect(template).toContain("label `hotfix`");
  });

  it("keeps Staging deployment on Vercel Git Integration without a workflow_run deploy", () => {
    const workflow = read(".github/workflows/deploy-staging.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toContain("workflow_run:");
    expect(workflow).not.toContain("vercel deploy");
    expect(workflow).toContain("preview.neurocapacitar.com.br");
    expect(workflow).toContain("api/health/ready");
  });

  it("keeps the JMVStream cron and changes its cadence to fifteen minutes", () => {
    const vercel = read("vercel.json");
    const stagingJobs = read(".github/workflows/run-staging-jobs.yml");

    expect(vercel).toContain('"path": "/api/cron/jmvstream"');
    expect(vercel).toContain('"schedule": "*/15 * * * *"');
    expect(stagingJobs).toContain('call_job "/api/cron/jmvstream"');
    expect(stagingJobs).not.toContain('cron: "*/5 * * * *"');
  });

  it("defines a release workflow with normal and hotfix modes", () => {
    const workflow = read(".github/workflows/deploy-vercel.yml");

    expect(workflow).toContain("mode:");
    expect(workflow).toContain("release-staging");
    expect(workflow).toContain("hotfix");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("git push origin");
    expect(workflow).toContain("Await automatic Production deployment");
    expect(workflow).toContain("Verify exact Staging deployment");
    expect(workflow).toContain("githubCommitSha");
    expect(workflow).toContain(
      "Hotfix Production requires a successful CI run"
    );
    expect(workflow).not.toContain("release_sha:");
    expect(workflow).not.toContain("confirm_production:");
  });

  it("defines a guarded workflow to reconcile Production-only hotfixes into Staging", () => {
    const workflow = read(".github/workflows/prepare-production-release.yml");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("git merge-base --is-ancestor");
    expect(workflow).toContain("sync/production-into-staging-");
    expect(workflow).toContain("git merge --no-edit origin/main");
    expect(workflow).toContain("git merge --abort");
    expect(workflow).toContain("conflict");
    expect(workflow).toContain("gh pr create");
    expect(workflow).toContain("--base staging");
    expect(workflow).toContain("gh workflow run ci.yml");
  });
});
