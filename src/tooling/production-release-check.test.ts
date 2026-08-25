import { describe, expect, it } from "vitest";
import {
  verifyDocumentedReleaseCheckpoint,
  verifyProductionReleaseState,
} from "./production-release-check";

const releaseSha = "a".repeat(40);

describe("Production release provider evidence", () => {
  it("does not require a self-referential document checkpoint for a deployment candidate", () => {
    const previousRelease = "b".repeat(40);
    const releaseState = {
      deployed: { commit: previousRelease, environment: "production" },
      documented: { commit: previousRelease, environment: "production" },
      verified: { commit: previousRelease, environment: "production" },
    } as const;

    expect(
      verifyDocumentedReleaseCheckpoint({
        checkpoint: undefined,
        releaseSha,
        releaseState,
      })
    ).toEqual([]);
    expect(
      verifyDocumentedReleaseCheckpoint({
        checkpoint: "verified",
        releaseSha,
        releaseState,
      })
    ).toEqual(["release_state_verified_mismatch"]);
    expect(
      verifyDocumentedReleaseCheckpoint({
        checkpoint: "verified",
        releaseSha,
        releaseState: undefined,
      })
    ).toEqual(["release_state_document_missing"]);
  });

  it("accepts matching Vercel, Neon and read-only PostgreSQL observations", () => {
    expect(
      verifyProductionReleaseState({
        database: {
          journalEntryCount: 68,
          latestMigrationTimestamp: 1_787_582_200_256,
          readOnly: true,
          serverMajorVersion: 18,
        },
        expected: {
          canonicalAlias: "app.neurocapacitar.com.br",
          journalEntryCount: 68,
          latestMigrationTimestamp: 1_787_582_200_256,
          neonBranchId: "br-production",
          neonProjectId: "project-production",
          releaseSha,
          requireCanonicalAlias: true,
          vercelProjectId: "prj_hub",
        },
        neon: {
          branch: {
            current_state: "ready",
            id: "br-production",
            project_id: "project-production",
          },
        },
        vercel: {
          alias: ["app.neurocapacitar.com.br"],
          meta: { githubCommitSha: releaseSha },
          projectId: "prj_hub",
          readyState: "READY",
          target: "production",
        },
      })
    ).toEqual([]);
  });

  it("reports a closed mismatch list without provider payloads", () => {
    const errors = verifyProductionReleaseState({
      database: {
        journalEntryCount: 67,
        latestMigrationTimestamp: 1,
        readOnly: false,
        serverMajorVersion: 17,
      },
      expected: {
        canonicalAlias: "app.neurocapacitar.com.br",
        journalEntryCount: 68,
        latestMigrationTimestamp: 1_787_582_200_256,
        neonBranchId: "br-production",
        neonProjectId: "project-production",
        releaseSha,
        requireCanonicalAlias: true,
        vercelProjectId: "prj_hub",
      },
      neon: { branch: { current_state: "init", id: "wrong" } },
      vercel: {
        alias: [],
        meta: { githubCommitSha: "b".repeat(40) },
        projectId: "wrong",
        readyState: "ERROR",
        target: "preview",
      },
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        "vercel_state_mismatch",
        "vercel_release_mismatch",
        "vercel_alias_mismatch",
        "neon_branch_mismatch",
        "postgres_version_mismatch",
        "migration_marker_mismatch",
        "database_read_only_proof_missing",
      ])
    );
  });
});
