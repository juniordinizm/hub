import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflowPath = join(
  import.meta.dirname,
  "../../.github/workflows/deploy-vercel.yml"
);

describe("Production release backup freshness gate", () => {
  it("runs before the Neon release branch and migration", async () => {
    const source = await readFile(workflowPath, "utf8");
    const gate = source.indexOf("bun run ops:check:production-backup");
    const branch = source.indexOf("Create confirmed Production Neon backup");
    const migration = source.indexOf("Apply Production migrations");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(branch);
    expect(gate).toBeLessThan(migration);
  });

  it("uses the separate read-only R2 credential and exact backup bucket", async () => {
    const source = await readFile(workflowPath, "utf8");
    for (const name of [
      "RESTORE_R2_ACCESS_KEY_ID",
      "RESTORE_R2_SECRET_ACCESS_KEY",
      "BACKUP_R2_ACCOUNT_ID",
      "BACKUP_R2_BUCKET_NAME",
    ]) {
      expect(source).toContain(name);
    }
    expect(source).not.toContain("BACKUP_R2_SECRET_ACCESS_KEY:");
  });
});
