import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertStagingTarget } from "./staging-target";

const STAGING_URL =
  "postgresql://user:secret@ep-staging-pooler.sa-east-1.aws.neon.tech/neondb";

describe("Staging database target", () => {
  it("accepts the explicitly confirmed Staging compute", () => {
    expect(
      assertStagingTarget({
        branchId: "br-staging",
        confirmation: "staging",
        databaseUrl: STAGING_URL,
        expectedBranchId: "br-staging",
        expectedHost: "ep-staging.sa-east-1.aws.neon.tech",
      })
    ).toEqual({
      branchId: "br-staging",
      databaseName: "neondb",
      host: "ep-staging.sa-east-1.aws.neon.tech",
    });
  });

  it("rejects Production, wrong branch, and weak confirmation", () => {
    expect(() =>
      assertStagingTarget({
        branchId: "br-staging",
        confirmation: "staging",
        databaseUrl:
          "postgresql://user:do-not-print@ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech/neondb",
        expectedBranchId: "br-staging",
        expectedHost: "ep-hidden-tooth-ac843qc2.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Staging command refuses the Production Neon compute.");
    expect(() =>
      assertStagingTarget({
        branchId: "br-other",
        confirmation: "staging",
        databaseUrl: STAGING_URL,
        expectedBranchId: "br-staging",
        expectedHost: "ep-staging.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Staging branch does not match STAGING_NEON_BRANCH_ID.");
    expect(() =>
      assertStagingTarget({
        branchId: "br-staging",
        confirmation: "production",
        databaseUrl: STAGING_URL,
        expectedBranchId: "br-staging",
        expectedHost: "ep-staging.sa-east-1.aws.neon.tech",
      })
    ).toThrow("Set STAGING_OPERATION_CONFIRMATION=staging.");
  });

  it("keeps Staging operational scripts on the guarded direct target", () => {
    for (const script of [
      "scripts/migrate-staging.ts",
      "scripts/seed-staging-admin.ts",
      "scripts/reset-staging.ts",
    ]) {
      const source = readFileSync(resolve(process.cwd(), script), "utf8");
      expect(source).toContain("DATABASE_URL_DIRECT");
      expect(source).toContain("STAGING_DATABASE_HOST");
      expect(source).toContain("STAGING_NEON_BRANCH_ID");
      expect(source).toContain("STAGING_OPERATION_CONFIRMATION");
      expect(source).toContain("assertStagingTarget");
    }
  });

  it("requires explicit reset mode and both execute confirmations", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/reset-staging.ts"),
      "utf8"
    );

    expect(source).toContain("--mode=plan");
    expect(source).toContain("--mode=execute");
    expect(source).toContain("--environment=staging");
    expect(source).toContain("--confirm-reset=true");
    expect(source).toContain("--confirmation=RESET_STAGING_DATA");
    expect(source).toContain("__drizzle_migrations");
    expect(source).toContain("RESTART IDENTITY CASCADE");
    expect(source).toContain("rollback");
  });

  it("restores the two-Admin TOTP rollout invariant after a Staging reset", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/reset-staging.yml"),
      "utf8"
    );

    expect(workflow).toContain("STAGING_RECOVERY_ADMIN_EMAIL");
    expect(workflow).toContain("STAGING_RECOVERY_ADMIN_PASSWORD");
    expect(workflow).toContain('"2|0|0"');
  });
});
