import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const workflowPath = join(
  root,
  ".github/workflows/backup-production-database.yml"
);
const packagePath = join(root, "package.json");
const CRON_PATTERN = /cron:\s*["']([^"']+)["']/g;

describe("production database backup workflow", () => {
  it("keeps one literal six-hour schedule synchronized with the public cadence", async () => {
    const source = await readFile(workflowPath, "utf8");
    const crons = [...source.matchAll(CRON_PATTERN)].map((match) => match[1]);
    expect(crons).toEqual(["17 */6 * * *"]);
    expect(source).toContain('BACKUP_CADENCE_HOURS: "6"');
    expect(source).toContain("workflow_dispatch:");
  });

  it("uses the protected environment, dedicated inputs and non-cancelling concurrency", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("environment: production-backup");
    expect(source).toContain("group: production-database-backup");
    expect(source).toContain("cancel-in-progress: false");
    expect(source).toContain("contents: read");
    expect(source).toContain("timeout-minutes:");
    for (const name of [
      "BACKUP_DATABASE_URL",
      "BACKUP_R2_ACCESS_KEY_ID",
      "BACKUP_R2_SECRET_ACCESS_KEY",
      "BACKUP_R2_ACCOUNT_ID",
      "BACKUP_R2_BUCKET_NAME",
      "BACKUP_AGE_RECIPIENT",
      "PRODUCTION_DATABASE_HOST",
      "PRODUCTION_NEON_BRANCH_ID",
      "PRODUCTION_NEON_PROJECT_ID",
      "NEON_API_KEY",
      "VERCEL_ORG_ID",
      "VERCEL_PROJECT_ID",
      "VERCEL_TOKEN",
    ]) {
      expect(source).toContain(name);
    }
  });

  it("pins Bun and age, verifies PostgreSQL 18 and never uploads backup artifacts", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(source).toContain("bun-version: 1.3.11");
    expect(source).toContain("age-v1.3.1-linux-amd64.tar.gz");
    expect(source).toContain(
      "bdc69c09cbdd6cf8b1f333d372a1f58247b3a33146406333e30c0f26e8f51377"
    );
    expect(source).toContain("postgresql-client-18");
    expect(source).toContain("pg_dump --version");
    expect(source).toContain("age --version");
    expect(source).not.toContain("upload-artifact");
    expect(source).toContain("bun install --frozen-lockfile");
    expect(source).toContain("bun run ops:backup:production");
  });

  it("exposes only the guarded backup entrypoint in package scripts", async () => {
    const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["ops:backup:production"]).toBe(
      "bun scripts/create-production-backup.ts"
    );
  });
});
