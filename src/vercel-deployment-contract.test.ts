import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const MOVING_GITHUB_ACTION_TAG_PATTERN = /uses:\s+[^#\n]+@v\d+(?:\s|$)/;
const WORKFLOW_RUN_TRIGGER_PATTERN = /\n {2}workflow_run:/;

describe("Vercel deployment contract", () => {
  it("keeps validation independent from deployment and removes the container release", async () => {
    const source = await readFile(".github/workflows/ci.yml", "utf8");

    expect(source).toContain("Quality gates");
    expect(source).toContain("PostgreSQL integration");
    expect(source).toContain("Browser journeys");
    expect(source).toContain("Build and dependency audit");
    expect(source).toContain("Vercel preview candidate");
    expect(source).not.toContain("ARM64 production image");
    expect(source).not.toContain("docker/build-push-action");
    expect(source).not.toMatch(MOVING_GITHUB_ACTION_TAG_PATTERN);
  });

  it("builds remotely and smokes an isolated preview only after every CI gate", async () => {
    const source = await readFile(".github/workflows/ci.yml", "utf8");
    const previewJob = source.slice(source.indexOf("  vercel-preview:"));

    expect(source).toContain("needs: build-and-knip");
    expect(source).toContain(
      'vercel@57.0.0 --scope="$VERCEL_SCOPE" deploy --yes'
    );
    expect(source).toContain("curl --fail-with-body --silent --show-error");
    expect(source).toContain("x-vercel-protection-bypass");
    expect(source).not.toContain("vercel@57.0.0 curl");
    expect(source).not.toContain("vercel@57.0.0 pull");
    expect(previewJob).toContain("name: vercel-preview");
    expect(previewJob).toContain("timeout-minutes: 20");
    expect(previewJob).toContain("githubCommitRef=");
    expect(previewJob).toContain("githubCommitSha=");
    expect(previewJob).toContain("VERCEL_SCOPE: neuro-capacitar");
    expect(previewJob).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(previewJob.match(/--scope="\$VERCEL_SCOPE"/g)).toHaveLength(1);
    expect(previewJob).toContain("HEALTHCHECK_SECRET");
    expect(previewJob).not.toContain("DATABASE_URL_DIRECT");
    expect(previewJob).not.toContain("R2_SECRET_ACCESS_KEY");
    expect(previewJob).not.toContain("RESEND_API_KEY");
  });

  it("requires an explicit approved main SHA before production migration and promotion", async () => {
    const source = await readFile(
      ".github/workflows/deploy-vercel.yml",
      "utf8"
    );

    expect(source).toContain("workflow_dispatch:");
    expect(source).toContain("release_sha:");
    expect(source).toContain("confirm_production:");
    expect(source).toContain("actions: read");
    expect(source).toContain("Verify approved main SHA and green CI");
    expect(source).toContain("origin/main");
    expect(source).toContain("actions/workflows/ci.yml/runs");
    expect(source).toContain(`ref: ${"${{"} inputs.release_sha }}`);
    expect(source).not.toMatch(WORKFLOW_RUN_TRIGGER_PATTERN);
    expect(source).toContain("environment:");
    expect(source).toContain("name: vercel-production");
    expect(source).toContain("timeout-minutes: 30");
    expect(source).toContain("DEPLOYMENT_GIT_REF: main");
    expect(source).toContain('--meta "githubCommitRef=');
    expect(source).toContain("githubCommitSha=");
    expect(source).toContain("VERCEL_SCOPE: neuro-capacitar");
    expect(source).toContain("VERCEL_AUTOMATION_BYPASS_SECRET");
    expect(source.match(/--scope="\$VERCEL_SCOPE"/g)).toHaveLength(2);
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain("bun run db:migrate:production");
    expect(source).toContain(
      "bun run db:migrations:inspect -- --environment=vercel-production"
    );
    expect(source).toContain("--prod --skip-domain");
    expect(source).toContain("curl --fail-with-body --silent --show-error");
    expect(source).toContain("x-vercel-protection-bypass");
    expect(source).toContain('vercel@57.0.0 --scope="$VERCEL_SCOPE" promote');
    expect(source).not.toContain("vercel@57.0.0 curl");
    expect(source).not.toContain("vercel@57.0.0 pull");
    expect(source).not.toContain("--prebuilt");
    expect(source.indexOf("bun run db:migrate:production")).toBeLessThan(
      source.indexOf("--prod --skip-domain")
    );
    expect(source.indexOf("--prod --skip-domain")).toBeLessThan(
      source.indexOf("x-vercel-protection-bypass")
    );
    expect(source.indexOf("x-vercel-protection-bypass")).toBeLessThan(
      source.indexOf('vercel@57.0.0 --scope="$VERCEL_SCOPE" promote')
    );
    expect(source).not.toMatch(MOVING_GITHUB_ACTION_TAG_PATTERN);
  });
});
