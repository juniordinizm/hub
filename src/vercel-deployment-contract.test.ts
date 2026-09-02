import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const MOVING_GITHUB_ACTION_TAG_PATTERN = /uses:\s+[^#\n]+@v\d+(?:\s|$)/;

describe("Vercel deployment contract", () => {
  it("keeps one provider-free CI job with local PostgreSQL", async () => {
    const source = await readFile(".github/workflows/ci.yml", "utf8");

    expect(source).toContain("name: CI");
    expect(source).toContain("branches: [main, staging]");
    expect(source).toContain("services:");
    expect(source).toContain("postgres:18-alpine");
    expect(source).toContain("create database hub_integration");
    expect(source).toContain("create database hub_e2e");
    expect(source).not.toContain("NEON_CI_API_KEY");
    expect(source).not.toContain("docker/build-push-action");
    expect(source).not.toMatch(MOVING_GITHUB_ACTION_TAG_PATTERN);
  });

  it("migrates Staging separately without creating a duplicate Vercel deployment", async () => {
    const ciSource = await readFile(".github/workflows/ci.yml", "utf8");
    const source = await readFile(
      ".github/workflows/deploy-staging.yml",
      "utf8"
    );

    expect(ciSource).not.toContain("vercel deploy");
    expect(source).toContain("push:");
    expect(source).toContain("branches: [staging]");
    expect(source).not.toContain("workflow_run:");
    expect(source).not.toContain("vercel deploy");
    expect(source).toContain("db:migrate:staging");
    expect(source).toContain("preview.neurocapacitar.com.br");
    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain("name: vercel-staging");
    expect(source).toContain("HEALTHCHECK_SECRET");
    expect(source).toContain("DATABASE_URL_DIRECT");
  });

  it("derives a Staging or hotfix candidate, gates migrations, and promotes one staged deployment", async () => {
    const source = await readFile(
      ".github/workflows/deploy-vercel.yml",
      "utf8"
    );

    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain("      mode:");
    expect(source).toContain("release-staging");
    expect(source).toContain("hotfix");
    expect(source).toContain("contents: write");
    expect(source).toContain("pull-requests: read");
    expect(source).toContain("checks: read");
    expect(source).toContain("git merge-base --is-ancestor");
    expect(source).toContain("check-runs?check_name=CI");
    expect(source).toContain(
      ["commits/", String.fromCharCode(36), "{staging_sha}", "/pulls"].join("")
    );
    expect(source).toContain(
      "No successful CI check exists for the Staging candidate"
    );
    expect(source).toContain("verify_staging:");
    expect(source).toContain("name: Verify exact Staging deployment");
    expect(source).toContain("needs: verify_staging");
    expect(source).toContain(
      "if: always() && (inputs.mode == 'hotfix' || needs.verify_staging.result == 'success')"
    );
    expect(source).toContain("githubCommitSha");
    expect(source).toContain("vercel@57.0.0 inspect app.neurocapacitar.com.br");
    expect(source).toContain("vercel@57.0.0 list hub");
    expect(source).toContain("--status=READY");
    expect(source).not.toContain("--environment=preview");
    expect(source).not.toContain("api.vercel.com/v6/deployments");
    expect(source).not.toContain("--status=BUILDING,READY,ERROR,CANCELED");
    expect(source).toContain("name: Await automatic Production deployment");
    expect(source).toContain("git push origin");
    expect(source).not.toContain("deploy --yes --prod");
    expect(source).toContain(
      "name: Require a recent independent Production backup"
    );
    expect(source).toContain("scripts/create-neon-recovery-branch.ts");
    expect(source).toContain("NEON_EXPIRES_AT");
    expect(source).not.toContain("suspend_timeout: 300");
    expect(source).toContain(
      "if: steps.release.outputs.has_migrations == 'true'"
    );
    expect(source).toContain("name: Smoke Production public profile");
    expect(source).toContain("Hotfix Production requires a successful CI run");
    expect(source).toContain("Hotfix Production requires the hotfix label");
    expect(source).toContain(
      "Hotfix Production cannot include database migrations"
    );
    expect(source).not.toContain("release_sha:");
    expect(source).not.toContain("confirm_production:");
    expect(source).not.toContain("EMERGENCY_SKIP_PRODUCTION");
    expect(
      source.indexOf("Await automatic Production deployment")
    ).toBeLessThan(source.indexOf("Apply Production migrations"));
    expect(source).not.toMatch(MOVING_GITHUB_ACTION_TAG_PATTERN);
  });

  it("keeps the Production backup freshness gate before backup creation and migration", async () => {
    const source = await readFile(
      ".github/workflows/deploy-vercel.yml",
      "utf8"
    );
    const gate = source.indexOf("bun run ops:check:production-backup");
    const branch = source.indexOf("Create confirmed Production Neon backup");
    const migration = source.indexOf("Apply Production migrations");

    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(branch);
    expect(gate).toBeLessThan(migration);
  });
});
