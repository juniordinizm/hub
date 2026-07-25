import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "..");
const IMMUTABLE_GITHUB_IMAGE_TAG_PATTERN =
  /ghcr\.io\/\$\{\{ github\.repository \}\}:\$\{\{ github\.sha \}\}/;
const MUTABLE_GITHUB_IMAGE_TAG_PATTERN =
  /ghcr\.io\/\$\{\{ github\.repository \}\}:latest/;
const RUNTIME_SECRET_ARGUMENT_PATTERN =
  /ARG (?:DATABASE_URL|BETTER_AUTH_SECRET|CRON_SECRET|R2_ACCESS_KEY_ID)/;
const MOVING_GITHUB_ACTION_TAG_PATTERN = /uses:\s+[^#\n]+@v\d+(?:\s|$)/;

describe("Coolify container contract", () => {
  it("builds a versioned standalone Next.js artifact", async () => {
    const source = await readFile(
      resolve(projectRoot, "next.config.ts"),
      "utf8"
    );

    expect(source).toContain('output: "standalone"');
    expect(source).toContain("deploymentId");
    expect(source).toContain("DEPLOYMENT_VERSION");
  });

  it("sets a global browser hardening baseline", async () => {
    const source = await readFile(
      resolve(projectRoot, "next.config.ts"),
      "utf8"
    );

    expect(source).toContain("Content-Security-Policy");
    expect(source).toContain("Strict-Transport-Security");
    expect(source).toContain("X-Content-Type-Options");
    expect(source).toContain("Referrer-Policy");
    expect(source).toContain("Permissions-Policy");
    expect(source).toContain("frame-ancestors 'none'");
  });

  it("uses the pinned build and ARM-compatible production runtimes", async () => {
    const source = await readFile(resolve(projectRoot, "Dockerfile"), "utf8");

    expect(source).toContain("oven/bun:1.3.11");
    expect(source).toContain("node:24.18.0-bookworm-slim");
    expect(source).toContain(
      "COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone"
    );
    expect(source).toContain(
      "COPY --from=builder --chown=nextjs:nodejs /app/.next/static"
    );
    expect(source).toContain(
      "COPY --from=builder --chown=nextjs:nodejs /app/public"
    );
    expect(source).toContain("USER nextjs");
    expect(source).toContain("HEALTHCHECK");
    expect(source).toContain("/api/health/ready");
    expect(source).toContain("process.env.HEALTHCHECK_SECRET");
    expect(source).toContain("migrate-production.mjs");
    expect(source).toContain("/app/src/db/migrations");
    expect(source).toContain("run-scheduled-job.mjs");
    expect(source).toContain("/app/node_modules/@img");
    expect(source).not.toMatch(RUNTIME_SECRET_ARGUMENT_PATTERN);
  });

  it("keeps local dependencies, outputs, and environment files out of context", async () => {
    const source = await readFile(
      resolve(projectRoot, ".dockerignore"),
      "utf8"
    );

    expect(source).toContain(".env*");
    expect(source).toContain("!.env.example");
    expect(source).toContain("node_modules");
    expect(source).toContain(".next");
    expect(source).toContain(".git");
    expect(source).toContain("tools");
  });

  it("builds and publishes an immutable ARM64 image in CI", async () => {
    const source = await readFile(
      resolve(projectRoot, ".github/workflows/ci.yml"),
      "utf8"
    );

    expect(source).toContain("platforms: linux/arm64");
    expect(source).toContain(
      "docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a"
    );
    expect(source).toMatch(IMMUTABLE_GITHUB_IMAGE_TAG_PATTERN);
    expect(source).toContain("NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=");
    expect(source).toContain("Smoke ARM64 image");
    expect(source).toContain("require('sharp').versions.sharp");
    expect(source).toContain("postgres:18-alpine");
    expect(source).toContain("node /app/migrate-production.mjs");
    expect(source).toContain("bun audit --production");
    expect(source).toContain(
      "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"
    );
    expect(source).not.toMatch(MUTABLE_GITHUB_IMAGE_TAG_PATTERN);
    expect(source).not.toMatch(MOVING_GITHUB_ACTION_TAG_PATTERN);
  });

  it("does not expose provider-backed jobs to Dependabot pull requests", async () => {
    const source = await readFile(
      resolve(projectRoot, ".github/workflows/ci.yml"),
      "utf8"
    );

    expect(source.match(/github\.actor != 'dependabot\[bot\]'/g)).toHaveLength(
      2
    );
    expect(source).toContain(
      "if: always() && steps.playwright.outcome != 'skipped'"
    );
  });

  it("waits for freshly created Neon computes before running migrations", async () => {
    const source = await readFile(
      resolve(projectRoot, ".github/workflows/ci.yml"),
      "utf8"
    );

    expect(source.match(/for attempt in 1 2 3 4 5; do/g)).toHaveLength(2);
    expect(source).toContain('sleep "$((attempt * 3))"');
  });

  it("keeps migration-only credentials out of the E2E web runtime", async () => {
    const source = await readFile(
      resolve(projectRoot, "playwright.config.ts"),
      "utf8"
    );

    expect(source).toContain('DATABASE_URL_DIRECT: ""');
    expect(source).toContain('INTERNAL_BOOTSTRAP_SECRET: ""');
  });

  it("keeps immutable GitHub Action pins current through Dependabot", async () => {
    const source = await readFile(
      resolve(projectRoot, ".github/dependabot.yml"),
      "utf8"
    );

    expect(source).toContain("package-ecosystem: github-actions");
    expect(source).toContain("interval: weekly");
  });
});
