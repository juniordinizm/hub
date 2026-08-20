import { describe, expect, it, vi } from "vitest";
import {
  type NeonReleaseBranch,
  runReleaseBackupCleanup,
  selectSupersededReleaseBackups,
} from "./neon-release-backup-cleanup";

const branch = (overrides: Partial<NeonReleaseBranch>): NeonReleaseBranch => ({
  created_at: "2026-08-20T01:00:00.000Z",
  current_state: "ready",
  default: false,
  expires_at: "2026-09-03T01:00:00.000Z",
  id: "br-default",
  name: "production-release-default",
  parent_id: "production-parent",
  primary: false,
  project_id: "release-project",
  protected: false,
  ...overrides,
});

describe("selectSupersededReleaseBackups", () => {
  it("keeps the newest matching backup and filters every unsafe branch", () => {
    const result = selectSupersededReleaseBackups(
      [
        branch({
          created_at: "2026-08-20T01:00:00.000Z",
          id: "br-newest",
          name: "production-release-newest",
        }),
        branch({
          created_at: "2026-08-19T23:00:00.000Z",
          id: "br-old",
          name: "production-release-old",
        }),
        branch({
          id: "br-staging",
          name: "staging-release-old",
        }),
        branch({
          id: "br-historical",
          name: "asaas-cutover-backup-20260731T045620Z",
        }),
        branch({
          id: "br-other-project",
          name: "production-release-other-project",
          project_id: "other-project",
        }),
        branch({
          id: "br-other-parent",
          name: "production-release-other-parent",
          parent_id: "other-parent",
        }),
        branch({
          current_state: "creating",
          id: "br-not-ready",
          name: "production-release-not-ready",
        }),
        branch({
          id: "br-protected",
          name: "production-release-protected",
          protected: true,
        }),
      ],
      {
        environment: "production",
        parentBranchId: "production-parent",
        projectId: "release-project",
      }
    );

    expect(result.latest?.id).toBe("br-newest");
    expect(result.candidates.map(({ id }) => id)).toEqual(["br-old"]);
  });

  it("selects only the staging prefix for staging", () => {
    const result = selectSupersededReleaseBackups(
      [
        branch({ id: "br-production", name: "production-release-new" }),
        branch({
          id: "br-staging-new",
          name: "staging-release-new",
          parent_id: "staging-parent",
        }),
        branch({
          created_at: "2026-08-19T01:00:00.000Z",
          id: "br-staging-old",
          name: "staging-release-old",
          parent_id: "staging-parent",
        }),
      ],
      {
        environment: "staging",
        parentBranchId: "staging-parent",
        projectId: "release-project",
      }
    );

    expect(result.latest?.id).toBe("br-staging-new");
    expect(result.candidates.map(({ id }) => id)).toEqual(["br-staging-old"]);
  });
});

describe("runReleaseBackupCleanup", () => {
  it("dry-runs without deleting and requires confirmation for execute", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      expect(init?.method).not.toBe("DELETE");
      expect(String(input)).toContain("/projects/release-project/branches");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            branches: [
              branch({
                id: "br-newest",
                name: "production-release-newest",
              }),
              branch({
                created_at: "2026-08-19T01:00:00.000Z",
                id: "br-old",
                name: "production-release-old",
              }),
            ],
          }),
          { status: 200 }
        )
      );
    });
    const output: string[] = [];
    const environment = {
      NEON_API_KEY: "secret",
      NEON_RELEASE_PARENT_BRANCH_ID: "production-parent",
      NEON_RELEASE_PROJECT_ID: "release-project",
    };

    await expect(
      runReleaseBackupCleanup({
        argv: ["--environment=production", "--dry-run"],
        environment,
        fetchImpl,
        writeOutput: (value) => output.push(value),
      })
    ).resolves.toEqual({
      deleted: [],
      environment: "production",
      preserved: ["br-newest"],
      wouldDelete: ["br-old"],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(output.join(" ")).toContain('"mode":"dry-run"');

    await expect(
      runReleaseBackupCleanup({
        argv: ["--environment=production", "--execute"],
        environment,
        fetchImpl,
      })
    ).rejects.toThrow("RELEASE_BACKUP_CLEANUP_CONFIRMATION");
  });

  it("deletes only superseded release backups after explicit confirmation", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (init?.method === "DELETE") {
        expect(String(input)).toContain("br-old");
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            branches: [
              branch({
                id: "br-newest",
                name: "production-release-newest",
              }),
              branch({
                created_at: "2026-08-19T01:00:00.000Z",
                id: "br-old",
                name: "production-release-old",
              }),
            ],
          }),
          { status: 200 }
        )
      );
    });

    await expect(
      runReleaseBackupCleanup({
        argv: ["--environment=production", "--execute"],
        environment: {
          NEON_API_KEY: "secret",
          NEON_RELEASE_PARENT_BRANCH_ID: "production-parent",
          NEON_RELEASE_PROJECT_ID: "release-project",
          RELEASE_BACKUP_CLEANUP_CONFIRMATION: "cleanup-release-backups",
        },
        fetchImpl,
      })
    ).resolves.toEqual({
      deleted: ["br-old"],
      environment: "production",
      preserved: ["br-newest"],
      wouldDelete: [],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the candidate cap is exceeded", async () => {
    const branches = Array.from({ length: 4 }, (_, index) =>
      branch({
        created_at: `2026-08-${String(20 - index).padStart(2, "0")}T01:00:00.000Z`,
        id: `br-${index}`,
        name: `production-release-${index}`,
      })
    );

    await expect(
      runReleaseBackupCleanup({
        argv: ["--environment=production", "--execute"],
        environment: {
          NEON_API_KEY: "secret",
          NEON_RELEASE_PARENT_BRANCH_ID: "production-parent",
          NEON_RELEASE_PROJECT_ID: "release-project",
          RELEASE_BACKUP_CLEANUP_CONFIRMATION: "cleanup-release-backups",
        },
        fetchImpl: vi.fn<typeof fetch>(() =>
          Promise.resolve(
            new Response(JSON.stringify({ branches }), { status: 200 })
          )
        ),
      })
    ).rejects.toThrow("more than 2 release backups");
  });
});
