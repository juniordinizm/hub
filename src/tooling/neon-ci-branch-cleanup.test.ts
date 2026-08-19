import { describe, expect, it, vi } from "vitest";
import {
  type NeonCiBranch,
  runCiNeonBranchCleanup,
  selectStaleCiBranches,
} from "./neon-ci-branch-cleanup";

const NOW = new Date("2026-08-19T12:00:00.000Z");

const branch = (overrides: Partial<NeonCiBranch>): NeonCiBranch => ({
  id: "br-default",
  project_id: "ci-project",
  name: "ci-integration-default",
  current_state: "ready",
  primary: false,
  default: false,
  protected: false,
  created_at: "2026-08-19T11:00:00.000Z",
  expires_at: "2026-08-20T11:00:00.000Z",
  ...overrides,
});

describe("selectStaleCiBranches", () => {
  it("selects only expired or orphaned CI branches", () => {
    const branches = [
      branch({
        id: "br-expired",
        name: "ci-integration-expired",
        expires_at: "2026-08-19T11:00:00.000Z",
      }),
      branch({
        id: "br-orphan",
        name: "ci-e2e-orphan",
        created_at: "2026-08-17T00:00:00.000Z",
        expires_at: null,
      }),
      branch({
        id: "br-future",
        name: "ci-e2e-future",
      }),
      branch({
        id: "br-staging",
        name: "staging-release-old",
        expires_at: "2026-08-18T00:00:00.000Z",
      }),
      branch({
        id: "br-protected",
        name: "ci-integration-protected",
        expires_at: "2026-08-18T00:00:00.000Z",
        protected: true,
      }),
      branch({
        id: "br-other-project",
        name: "ci-integration-other-project",
        project_id: "other-project",
        expires_at: "2026-08-18T00:00:00.000Z",
      }),
    ];

    expect(
      selectStaleCiBranches(branches, {
        now: NOW,
        projectId: "ci-project",
        staleAfterMs: 26 * 60 * 60 * 1000,
      }).map(({ id }) => id)
    ).toEqual(["br-orphan", "br-expired"]);
  });
});

describe("runCiNeonBranchCleanup", () => {
  it("dry-runs without deleting and execute requires the confirmation", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      expect(String(input)).toContain("/projects/ci-project/branches");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            branches: [
              branch({
                id: "br-expired",
                expires_at: "2026-08-19T11:00:00.000Z",
              }),
            ],
          }),
          { status: 200 }
        )
      );
    });
    const output: string[] = [];

    const dryRun = await runCiNeonBranchCleanup({
      argv: ["--dry-run"],
      environment: {
        NEON_CI_API_KEY: "secret",
        NEON_CI_PROJECT_ID: "ci-project",
      },
      fetchImpl,
      now: NOW,
      writeOutput: (value) => output.push(value),
    });

    expect(dryRun).toEqual({ deleted: [], wouldDelete: ["br-expired"] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(output.join(" ")).toContain("dry-run");

    await expect(
      runCiNeonBranchCleanup({
        argv: ["--execute"],
        environment: {
          NEON_CI_API_KEY: "secret",
          NEON_CI_PROJECT_ID: "ci-project",
        },
        fetchImpl,
        now: NOW,
      })
    ).rejects.toThrow("CI_NEON_CLEANUP_CONFIRMATION");
  });

  it("deletes only selected branches after explicit confirmation", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (init?.method === "DELETE") {
        expect(String(input)).toContain("br-default");
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            branches: [branch({ expires_at: NOW.toISOString() })],
          }),
          { status: 200 }
        )
      );
    });

    const result = await runCiNeonBranchCleanup({
      argv: ["--execute"],
      environment: {
        CI_NEON_CLEANUP_CONFIRMATION: "cleanup-ci-neon",
        NEON_CI_API_KEY: "secret",
        NEON_CI_PROJECT_ID: "ci-project",
      },
      fetchImpl,
      now: NOW,
    });

    expect(result).toEqual({ deleted: ["br-default"], wouldDelete: [] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("follows Neon branch cursors before selecting stale branches", async () => {
    const fetchImpl = vi.fn<typeof fetch>((input, init) => {
      if (init?.method === "DELETE") {
        expect(String(input)).toContain("br-page-two");
        return Promise.resolve(new Response(null, { status: 204 }));
      }

      const url = new URL(String(input));
      if (!url.searchParams.has("cursor")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              branches: [branch({ id: "br-page-one" })],
              pagination: { next: "cursor-page-two" },
            }),
            { status: 200 }
          )
        );
      }

      expect(url.searchParams.get("cursor")).toBe("cursor-page-two");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            branches: [
              branch({
                id: "br-page-two",
                expires_at: "2026-08-19T11:00:00.000Z",
              }),
            ],
            pagination: { next: null },
          }),
          { status: 200 }
        )
      );
    });

    await expect(
      runCiNeonBranchCleanup({
        argv: ["--execute"],
        environment: {
          CI_NEON_CLEANUP_CONFIRMATION: "cleanup-ci-neon",
          NEON_CI_API_KEY: "secret",
          NEON_CI_PROJECT_ID: "ci-project",
        },
        fetchImpl,
        now: NOW,
      })
    ).resolves.toEqual({ deleted: ["br-page-two"], wouldDelete: [] });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
